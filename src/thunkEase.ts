import {
  createSlice,
  type ActionReducerMapBuilder,
  type CaseReducer,
  type PayloadAction,
  type SerializedError,
  type Slice,
  type SliceCaseReducers
} from '@reduxjs/toolkit';

import { deepMerge } from './deepMerge';
import {
  AsyncThunkStatuses,
  createInitialApiState,
  type ApiState,
  type ConvertedThunks,
  type HashMapApiState,
  type HashMapKey,
  type PureStateName,
  type ThunkRecord
} from './types';

/* -------------------------------------------------------------------------- */
/* Thunk key parsing                                                          */
/* -------------------------------------------------------------------------- */

type ThunkMode =
  /** `getUser` — one slot, `data` replaced on every fulfilled action. */
  | { kind: 'single'; stateKey: string }
  /** `getUsers$items` — one slot, `payload.items` appended onto `data.items`. */
  | { kind: 'paginated'; stateKey: string; field: string }
  /**
   * `getUser_id` — a slot per argument value, keyed by `meta.arg.id`.
   * A bare trailing `_` (`getUser_`) keys by the whole `meta.arg` instead.
   */
  | { kind: 'hashMap'; stateKey: string; argKey: string | undefined };

function parseThunkKey(thunkKey: string): ThunkMode {
  if (thunkKey.includes('_')) {
    const [stateKey = '', argKey = ''] = thunkKey.split('_');
    if (!stateKey) {
      throw new Error(`thunkEase: thunk key "${thunkKey}" has no name before its "_" separator.`);
    }
    return { kind: 'hashMap', stateKey, argKey: argKey || undefined };
  }

  if (thunkKey.includes('$')) {
    const [stateKey = '', field = ''] = thunkKey.split('$');
    if (!stateKey) {
      throw new Error(`thunkEase: thunk key "${thunkKey}" has no name before its "$" separator.`);
    }
    if (!field) {
      throw new Error(
        `thunkEase: thunk key "${thunkKey}" ends with "$" but names no field to append into. ` +
          `Write "${stateKey}$items" to paginate, or "${stateKey}" for a plain slot.`
      );
    }
    return { kind: 'paginated', stateKey, field };
  }

  return { kind: 'single', stateKey: thunkKey };
}

function sameMode(a: ThunkMode, b: ThunkMode): boolean {
  if (a.kind !== b.kind) return false;
  if (a.kind === 'paginated' && b.kind === 'paginated') return a.field === b.field;
  if (a.kind === 'hashMap' && b.kind === 'hashMap') return a.argKey === b.argKey;
  return true;
}

/**
 * Resolves the bucket key for a hash-map thunk. `argKey` undefined means the
 * whole `meta.arg` is the key (the `getUser_` form).
 */
function resolveHashKey(arg: unknown, argKey: string | undefined): string {
  const raw = argKey === undefined ? arg : (arg as Record<string, unknown> | null | undefined)?.[argKey];
  return String(raw);
}

function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

/* -------------------------------------------------------------------------- */
/* Generated reset / invalidate reducers                                      */
/* -------------------------------------------------------------------------- */

type AnyApiState = ApiState<unknown>;
type AnyState = Record<string, unknown>;

const { IDLE, LOADING, FAILED, SUCCEEDED } = AsyncThunkStatuses;

function toIdle(slot: AnyApiState | undefined): void {
  if (!slot) return;
  slot.status = IDLE;
  slot.isLoading = false;
}

function buildGeneratedReducers(modes: Map<string, ThunkMode>): Record<string, CaseReducer<any, any>> {
  const generated: Record<string, CaseReducer<any, any>> = {};

  for (const [stateKey, mode] of modes) {
    const suffix = capitalize(stateKey);

    if (mode.kind === 'hashMap') {
      generated[`reset${suffix}`] = (state: AnyState, action: PayloadAction<HashMapKey | undefined>) => {
        if (action.payload === undefined) {
          state[stateKey] = {};
          return;
        }
        delete (state[stateKey] as HashMapApiState<unknown> | undefined)?.[String(action.payload)];
      };

      generated[`invalidate${suffix}`] = (state: AnyState, action: PayloadAction<HashMapKey | undefined>) => {
        const buckets = state[stateKey] as HashMapApiState<unknown> | undefined;
        if (!buckets) return;

        if (action.payload === undefined) {
          for (const bucket of Object.values(buckets)) toIdle(bucket);
          return;
        }
        toIdle(buckets[String(action.payload)]);
      };

      continue;
    }

    generated[`reset${suffix}`] = (state: AnyState) => {
      state[stateKey] = createInitialApiState();
    };

    generated[`invalidate${suffix}`] = (state: AnyState) => {
      toIdle(state[stateKey] as AnyApiState | undefined);
    };

    if (mode.kind === 'paginated') {
      const { field } = mode;
      // Drops the accumulated page array but keeps the rest of `data` intact.
      generated[`reset${suffix}Page`] = (state: AnyState) => {
        const slot = state[stateKey] as AnyApiState | undefined;
        if (!slot?.data) return;
        (slot.data as Record<string, unknown>)[field] = [];
      };
    }
  }

  return generated;
}

/* -------------------------------------------------------------------------- */
/* Public types                                                               */
/* -------------------------------------------------------------------------- */

type ResetPayload<K> = K extends `${string}_${string}` ? HashMapKey | undefined : void;

/**
 * Case reducers accepted by `thunkEase`.
 *
 * Deliberately narrower than RTK's `SliceCaseReducers`, which is a union with
 * the reducer-creators and `{ reducer, prepare }` forms. TypeScript will not
 * contextually type a parameter against a union constraint, so widening this
 * would cost callers their inferred `state` inside `reducers`. Reach for
 * `extraReducers` or plain `createSlice` if you need a `prepare` callback.
 */
export type ThunkEaseCaseReducers<State> = Record<string, CaseReducer<State, any>>;

/**
 * No caller-supplied reducers. `Record<never, never>` rather than
 * `Record<string, never>`, which would add an index signature and make every
 * name appear to exist on `slice.actions`.
 */
type NoCaseReducers = Record<never, never>;

/** The reducers `thunkEase` adds on top of the ones you pass. */
export type GeneratedCaseReducers<State, T extends ThunkRecord> = {
  [K in keyof T as `reset${Capitalize<PureStateName<K & string>>}`]: CaseReducer<
    State,
    PayloadAction<ResetPayload<K>>
  >;
} & {
  [K in keyof T as `invalidate${Capitalize<PureStateName<K & string>>}`]: CaseReducer<
    State,
    PayloadAction<ResetPayload<K>>
  >;
} & {
  [K in keyof T as K extends `${string}_${string}`
    ? never
    : K extends `${string}$${string}`
      ? `reset${Capitalize<PureStateName<K & string>>}Page`
      : never]: CaseReducer<State, PayloadAction<void>>;
};

export interface ThunkEaseOptions<
  I extends object,
  T extends ThunkRecord,
  R extends ThunkEaseCaseReducers<I & ConvertedThunks<T>>
> {
  /** Slice name, as passed to `createSlice`. */
  name: string;
  /**
   * Thunks keyed by the state slot they fill. The key's suffix picks the mode:
   * `getUser` (single), `getUsers$items` (paginated), `getUser_id` (hash map).
   */
  thunks: T;
  /** Extra state alongside the generated slots. Generated slots win on conflict. */
  initialState?: I;
  /** Your own case reducers. Names may not collide with the generated ones. */
  reducers?: R;
  /**
   * Runs after the generated thunk cases. Use it for actions the thunks do not
   * cover — re-adding a case for a thunk that is already in `thunks` throws,
   * because Redux Toolkit rejects two reducers for one action type.
   */
  extraReducers?: (builder: ActionReducerMapBuilder<I & ConvertedThunks<T>>) => void;
}

export type ThunkEaseSlice<
  I extends object,
  T extends ThunkRecord,
  R extends ThunkEaseCaseReducers<I & ConvertedThunks<T>>
> = Slice<I & ConvertedThunks<T>, R & GeneratedCaseReducers<I & ConvertedThunks<T>, T>, string>;

/* -------------------------------------------------------------------------- */
/* thunkEase                                                                  */
/* -------------------------------------------------------------------------- */

/**
 * `createSlice`, but every thunk you hand it gets its own
 * `{ data, isLoading, error, status, isFetchedOnce }` slot plus the full
 * pending/rejected/fulfilled triad, wired for you.
 *
 * ```ts
 * const slice = thunkEase({
 *   name: 'user',
 *   thunks: { getProfile, getOrders$items, getAddress_addressId }
 * });
 *
 * state.user.getProfile.isLoading;
 * state.user.getAddress['a-1']?.data;
 * dispatch(slice.actions.invalidateGetProfile());
 * ```
 */
export function thunkEase<I extends object, T extends ThunkRecord>(
  options: Omit<ThunkEaseOptions<I, T, NoCaseReducers>, 'reducers'> & { reducers?: undefined }
): ThunkEaseSlice<I, T, NoCaseReducers>;
export function thunkEase<
  I extends object,
  T extends ThunkRecord,
  R extends ThunkEaseCaseReducers<I & ConvertedThunks<T>>
>(options: ThunkEaseOptions<I, T, R>): ThunkEaseSlice<I, T, R>;
// Two overloads rather than one signature with `R = NoCaseReducers`: a generic
// default suppresses contextual typing, which would leave `state` implicitly
// `any` inside caller `reducers`.
export function thunkEase<
  I extends object,
  T extends ThunkRecord,
  R extends ThunkEaseCaseReducers<I & ConvertedThunks<T>>
>({ name, thunks, initialState, reducers, extraReducers }: ThunkEaseOptions<I, T, R>): ThunkEaseSlice<I, T, R> {
  type State = I & ConvertedThunks<T>;

  const modes = new Map<string, ThunkMode>();
  const generatedInitialState: AnyState = {};

  for (const thunkKey of Object.keys(thunks)) {
    const mode = parseThunkKey(thunkKey);

    const existing = modes.get(mode.stateKey);
    if (existing && !sameMode(existing, mode)) {
      throw new Error(
        `thunkEase: thunk keys "${thunkKey}" and another key both map to state slot ` +
          `"${mode.stateKey}" but disagree on its shape.`
      );
    }
    modes.set(mode.stateKey, mode);

    // Hash maps start empty — buckets appear as arguments come in.
    generatedInitialState[mode.stateKey] = mode.kind === 'hashMap' ? {} : createInitialApiState();
  }

  const generatedReducers = buildGeneratedReducers(modes);

  const userReducers = (reducers ?? {}) as Record<string, unknown>;
  for (const generatedName of Object.keys(generatedReducers)) {
    if (generatedName in userReducers) {
      throw new Error(
        `thunkEase: reducer "${generatedName}" collides with an action generated for slice ` +
          `"${name}". Rename your reducer, or drop it and use the generated one.`
      );
    }
  }

  const slice = createSlice({
    name,
    initialState: deepMerge<State>(initialState, generatedInitialState),
    // Erased here because the reducer names are computed; `ThunkEaseSlice` is
    // what restores precise typing for callers.
    reducers: { ...generatedReducers, ...userReducers } as any,

    extraReducers: (builder: ActionReducerMapBuilder<State>) => {
      for (const [thunkKey, thunk] of Object.entries(thunks)) {
        if (!thunk) continue;

        const mode = parseThunkKey(thunkKey);
        const { stateKey } = mode;

        if (mode.kind === 'hashMap') {
          const { argKey } = mode;

          const bucketOf = (state: unknown, arg: unknown) => {
            const buckets = (state as AnyState)[stateKey] as HashMapApiState<unknown>;
            return { buckets, key: resolveHashKey(arg, argKey) };
          };

          builder
            .addCase(thunk.pending, (state, action) => {
              const { buckets, key } = bucketOf(state, action.meta.arg);
              buckets[key] = { ...(buckets[key] ?? createInitialApiState()), status: LOADING, isLoading: true };
            })
            .addCase(thunk.rejected, (state, action) => {
              const { buckets, key } = bucketOf(state, action.meta.arg);
              buckets[key] = {
                ...(buckets[key] ?? createInitialApiState()),
                status: FAILED,
                isLoading: false,
                error: action.error as SerializedError
              };
            })
            .addCase(thunk.fulfilled, (state, action) => {
              const { buckets, key } = bucketOf(state, action.meta.arg);
              buckets[key] = {
                status: SUCCEEDED,
                isLoading: false,
                error: undefined,
                isFetchedOnce: true,
                data: action.payload ?? {}
              };
            });

          continue;
        }

        const slotOf = (state: unknown) => (state as AnyState)[stateKey] as AnyApiState | undefined;

        builder
          .addCase(thunk.pending, (state) => {
            const slot = slotOf(state);
            if (!slot) return;
            slot.status = LOADING;
            slot.isLoading = true;
          })
          .addCase(thunk.rejected, (state, action) => {
            const slot = slotOf(state);
            if (!slot) return;
            slot.status = FAILED;
            slot.isLoading = false;
            slot.error = action.error as SerializedError;
          })
          .addCase(thunk.fulfilled, (state, action) => {
            const slot = slotOf(state);
            if (!slot) return;

            slot.status = SUCCEEDED;
            slot.isLoading = false;
            slot.error = undefined;
            slot.isFetchedOnce = true;

            if (!action.payload) {
              slot.data = {};
              return;
            }

            if (mode.kind === 'paginated') {
              const { field } = mode;
              const previousPages = (slot.data as Record<string, unknown> | undefined)?.[field];
              const nextPage = (action.payload as Record<string, unknown>)[field];

              slot.data = {
                ...(action.payload as Record<string, unknown>),
                [field]: [
                  ...(Array.isArray(previousPages) ? previousPages : []),
                  ...(Array.isArray(nextPage) ? nextPage : [])
                ]
              };
              return;
            }

            slot.data = action.payload;
          });
      }

      extraReducers?.(builder);
    }
  });

  return slice as unknown as ThunkEaseSlice<I, T, R>;
}

/** Back-compat alias. `thunkEase` is the preferred name. */
export const createSliceWithThunks = thunkEase;
