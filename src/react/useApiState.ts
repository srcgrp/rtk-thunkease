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

/**
 * Reads a single generated slot.
 *
 * ```ts
 * const { data, isLoading, isIdle } = useApiState((s: RootState) => s.user.getProfile);
 * ```
 *
 * A missing slot reads as idle rather than `undefined`, so components never have
 * to guard before destructuring.
 */
export function useApiState<S, T>(selector: (state: S) => ApiState<T> | undefined): ApiStateView<T> {
  const slot = useSelector(selector);
  return useMemo(() => toView(slot), [slot]);
}

/**
 * Reads one bucket out of a `name_argKey` slot.
 *
 * ```ts
 * const { data, isLoading } = useHashApiState((s: RootState) => s.user.getAddress, addressId);
 * ```
 *
 * Buckets only exist once their argument has been dispatched, so an unfetched
 * `key` reads as idle.
 */
export function useHashApiState<S, T>(
  selector: (state: S) => HashMapApiState<T> | undefined,
  key: HashMapKey | undefined
): ApiStateView<T> {
  const buckets = useSelector(selector);
  const slot = key === undefined ? undefined : buckets?.[String(key)];

  return useMemo(() => toView(slot), [slot]);
}
