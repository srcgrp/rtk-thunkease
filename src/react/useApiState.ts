import { useMemo } from 'react';
import { useSelector } from 'react-redux';

import { AsyncThunkStatuses, createInitialApiState, type ApiState, type HashMapApiState, type HashMapKey } from '../types';

/** An {@link ApiState} plus the status booleans components actually branch on. */
export interface ApiStateView<T> extends ApiState<T> {
  isIdle: boolean;
  isSuccess: boolean;
  isError: boolean;
}

function toView<T>(slot: ApiState<T> | undefined): ApiStateView<T> {
  const base = slot ?? createInitialApiState<T>();

  return {
    ...base,
    isIdle: base.status === AsyncThunkStatuses.IDLE,
    isSuccess: base.status === AsyncThunkStatuses.SUCCEEDED,
    isError: base.status === AsyncThunkStatuses.FAILED
  };
}

/** {@link useApiState} with its state type already pinned by `withTypes`. */
export interface TypedUseApiState<State> {
  <T>(selector: (state: State) => ApiState<T> | undefined): ApiStateView<T>;
  /** Re-pins the state type. */
  withTypes<S>(): TypedUseApiState<S>;
}

/** {@link useHashApiState} with its state type already pinned by `withTypes`. */
export interface TypedUseHashApiState<State> {
  <T>(selector: (state: State) => HashMapApiState<T> | undefined, key: HashMapKey | undefined): ApiStateView<T>;
  /** Re-pins the state type. */
  withTypes<S>(): TypedUseHashApiState<S>;
}

export interface UseApiState {
  <S, T>(selector: (state: S) => ApiState<T> | undefined): ApiStateView<T>;
  /**
   * Pins the store's state type so selectors no longer need it spelled out:
   * `const useApiState = useApiStateBase.withTypes<RootState>()`.
   */
  withTypes<S>(): TypedUseApiState<S>;
}

export interface UseHashApiState {
  <S, T>(selector: (state: S) => HashMapApiState<T> | undefined, key: HashMapKey | undefined): ApiStateView<T>;
  /**
   * Pins the store's state type so selectors no longer need it spelled out:
   * `const useHashApiState = useHashApiStateBase.withTypes<RootState>()`.
   */
  withTypes<S>(): TypedUseHashApiState<S>;
}

function useApiStateImpl<S, T>(selector: (state: S) => ApiState<T> | undefined): ApiStateView<T> {
  const slot = useSelector(selector);
  return useMemo(() => toView(slot), [slot]);
}

function useHashApiStateImpl<S, T>(
  selector: (state: S) => HashMapApiState<T> | undefined,
  key: HashMapKey | undefined
): ApiStateView<T> {
  const buckets = useSelector(selector);
  const slot = key === undefined ? undefined : buckets?.[String(key)];

  return useMemo(() => toView(slot), [slot]);
}

/**
 * Reads a single generated slot.
 *
 * ```ts
 * const { data, isLoading, isIdle } = useApiState((s: RootState) => s.user.getProfile);
 * ```
 *
 * TypeScript cannot infer the store's state from an unannotated selector, so
 * either annotate the parameter as above or pin it once with `withTypes`:
 *
 * ```ts
 * export const useApiState = useApiStateBase.withTypes<RootState>();
 * const { data } = useApiState((s) => s.user.getProfile); // s is RootState
 * ```
 *
 * A missing slot reads as idle rather than `undefined`, so components never have
 * to guard before destructuring.
 */
export const useApiState: UseApiState = Object.assign(useApiStateImpl, {
  withTypes<S>(): TypedUseApiState<S> {
    return useApiStateImpl as TypedUseApiState<S>;
  }
});

/**
 * Reads one bucket out of a `name_argKey` slot.
 *
 * ```ts
 * const { data, isLoading } = useHashApiState((s: RootState) => s.user.getAddress, addressId);
 * ```
 *
 * Takes the same `withTypes<RootState>()` treatment as {@link useApiState} when
 * you would rather not annotate every selector.
 *
 * Buckets only exist once their argument has been dispatched, so an unfetched
 * `key` reads as idle.
 */
export const useHashApiState: UseHashApiState = Object.assign(useHashApiStateImpl, {
  withTypes<S>(): TypedUseHashApiState<S> {
    return useHashApiStateImpl as TypedUseHashApiState<S>;
  }
});
