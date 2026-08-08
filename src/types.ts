import type { AsyncThunk, SerializedError } from '@reduxjs/toolkit';

/**
 * The four lifecycle states a thunk-backed slot moves through.
 *
 * These are the exact strings written into state, so `status === 'Idle'` reads
 * fine without importing anything.
 */
export const AsyncThunkStatuses = {
  IDLE: 'Idle',
  LOADING: 'Loading',
  FAILED: 'Failed',
  SUCCEEDED: 'Succeeded'
} as const;

export type AsyncThunkStatus = (typeof AsyncThunkStatuses)[keyof typeof AsyncThunkStatuses];

/** State generated for a single thunk. */
export interface ApiState<T> {
  data?: T;
  isLoading: boolean;
  error?: SerializedError;
  status: AsyncThunkStatus;
  /** Stays `true` after the first fulfilled response, across later reloads. */
  isFetchedOnce: boolean;
}

/** State generated for a `name_argKey` thunk: one {@link ApiState} per argument value. */
export interface HashMapApiState<T> {
  [key: string]: ApiState<T>;
}

/** Key type accepted by the generated hash-map actions. */
export type HashMapKey = string | number;

/**
 * A fresh, idle {@link ApiState}. Handy as the fallback when reading a hash-map
 * bucket that has not been fetched yet.
 */
export function createInitialApiState<T>(data?: T): ApiState<T> {
  return {
    data: (data === undefined ? {} : data) as T,
    isLoading: false,
    error: undefined,
    status: AsyncThunkStatuses.IDLE,
    isFetchedOnce: false
  };
}

/** Any record of thunks accepted by `thunkEase`. */
export type ThunkRecord = Record<string, AsyncThunk<any, any, any>>;

/** The fulfilled payload type of an `AsyncThunk`. */
export type GetAsyncThunkReturnType<T> = T extends AsyncThunk<infer Returned, any, any> ? Returned : never;

/** Strips the `$field` / `_argKey` suffix off a thunk key to get its state key. */
export type PureStateName<T extends string> = T extends `${infer Name}_${string}`
  ? Name
  : T extends `${infer Name}$${string}`
    ? Name
    : T;

/** The state `thunkEase` generates from a record of thunks. */
export type ConvertedThunks<T extends ThunkRecord> = {
  [K in keyof T as PureStateName<K & string>]: K extends `${string}_${string}`
    ? HashMapApiState<GetAsyncThunkReturnType<T[K]>>
    : ApiState<GetAsyncThunkReturnType<T[K]>>;
};
