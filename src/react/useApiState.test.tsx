import { configureStore, createAsyncThunk } from '@reduxjs/toolkit';
import { act, renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import { Provider } from 'react-redux';
import { describe, expect, it } from 'vitest';

import { thunkEase } from '../thunkEase';
import { AsyncThunkStatuses } from '../types';
import { useApiState, useHashApiState } from './useApiState';

const { IDLE, SUCCEEDED } = AsyncThunkStatuses;

const getProfile = createAsyncThunk('r/getProfile', async () => ({ name: 'Ada' }));
const getAddress = createAsyncThunk('r/getAddress', async (arg: { addressId: string }) => ({
  city: `city-${arg.addressId}`
}));

function setup() {
  const slice = thunkEase({
    name: 'r',
    thunks: { getProfile, getAddress_addressId: getAddress }
  });
  const store = configureStore({ reducer: { r: slice.reducer } });

  type RootState = ReturnType<typeof store.getState>;
  const wrapper = ({ children }: { children: ReactNode }) => <Provider store={store}>{children}</Provider>;

  return { slice, store, wrapper, _root: null as unknown as RootState };
}

type Root = ReturnType<typeof setup>['_root'];

describe('useApiState', () => {
  it('reads an idle slot with derived booleans', () => {
    const { wrapper } = setup();

    const { result } = renderHook(() => useApiState((s: Root) => s.r.getProfile), { wrapper });

    expect(result.current).toMatchObject({ status: IDLE, isIdle: true, isSuccess: false, isError: false });
  });

  it('re-renders with the fulfilled payload', async () => {
    const { store, wrapper } = setup();

    const { result } = renderHook(() => useApiState((s: Root) => s.r.getProfile), { wrapper });
    await act(async () => {
      await store.dispatch(getProfile());
    });

    expect(result.current).toMatchObject({ status: SUCCEEDED, isSuccess: true, data: { name: 'Ada' } });
  });

  it('keeps a stable reference while the slot is unchanged', () => {
    const { wrapper } = setup();

    const { result, rerender } = renderHook(() => useApiState((s: Root) => s.r.getProfile), { wrapper });
    const first = result.current;
    rerender();

    expect(result.current).toBe(first);
  });
});

describe('useHashApiState', () => {
  it('reads an unfetched bucket as idle', () => {
    const { wrapper } = setup();

    const { result } = renderHook(() => useHashApiState((s: Root) => s.r.getAddress, 'a1'), { wrapper });

    expect(result.current).toMatchObject({ status: IDLE, isIdle: true, data: {} });
  });

  it('reads the bucket for the given key once fetched', async () => {
    const { store, wrapper } = setup();

    const { result } = renderHook(() => useHashApiState((s: Root) => s.r.getAddress, 'a1'), { wrapper });
    await act(async () => {
      await store.dispatch(getAddress({ addressId: 'a1' }));
      await store.dispatch(getAddress({ addressId: 'a2' }));
    });

    expect(result.current).toMatchObject({ status: SUCCEEDED, data: { city: 'city-a1' } });
  });

  it('reads as idle when the key is undefined', () => {
    const { wrapper } = setup();

    const { result } = renderHook(() => useHashApiState((s: Root) => s.r.getAddress, undefined), { wrapper });

    expect(result.current.isIdle).toBe(true);
  });
});
