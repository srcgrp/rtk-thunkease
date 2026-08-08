import { createAsyncThunk } from '@reduxjs/toolkit';
import { describe, expectTypeOf, it } from 'vitest';

import { thunkEase } from './thunkEase';
import type { ApiState, HashMapApiState } from './types';

interface Profile {
  id: string;
  name: string;
}

const getProfile = createAsyncThunk('t/getProfile', async () => ({ id: 'u1', name: 'Ada' }) as Profile);
const getItems = createAsyncThunk('t/getItems', async (page: number) => ({ total: 10, items: [`i${page}`] }));
const getAddress = createAsyncThunk('t/getAddress', async (arg: { addressId: string }) => ({
  city: arg.addressId
}));

const slice = thunkEase({
  name: 't',
  initialState: { unrelated: 'kept' },
  thunks: {
    getProfile,
    getItems$items: getItems,
    getAddress_addressId: getAddress
  }
});

type State = ReturnType<typeof slice.getInitialState>;

type Has<T, K extends string> = K extends keyof T ? true : false;

describe('generated state types', () => {
  it('keeps the caller initialState keys', () => {
    expectTypeOf<State['unrelated']>().toEqualTypeOf<string>();
  });

  it('narrows a plain key to ApiState of the fulfilled payload', () => {
    expectTypeOf<State['getProfile']>().toEqualTypeOf<ApiState<Profile>>();
    expectTypeOf<State['getProfile']['data']>().toEqualTypeOf<Profile | undefined>();
  });

  it('strips the $field suffix and keeps ApiState', () => {
    expectTypeOf<State['getItems']>().toEqualTypeOf<ApiState<{ total: number; items: string[] }>>();
  });

  it('strips the _argKey suffix and widens to HashMapApiState', () => {
    expectTypeOf<State['getAddress']>().toEqualTypeOf<HashMapApiState<{ city: string }>>();
  });

  it('does not leak the suffixed keys into state', () => {
    expectTypeOf<Has<State, 'getItems$items'>>().toEqualTypeOf<false>();
    expectTypeOf<Has<State, 'getAddress_addressId'>>().toEqualTypeOf<false>();
  });
});

describe('generated action types', () => {
  it('gives plain slots no-argument reset and invalidate', () => {
    expectTypeOf(slice.actions.resetGetProfile).toBeCallableWith();
    expectTypeOf(slice.actions.invalidateGetProfile).toBeCallableWith();
  });

  it('gives hash-map slots an optional key', () => {
    expectTypeOf(slice.actions.resetGetAddress).toBeCallableWith();
    expectTypeOf(slice.actions.resetGetAddress).toBeCallableWith('a1');
    expectTypeOf(slice.actions.resetGetAddress).toBeCallableWith(7);
    expectTypeOf(slice.actions.invalidateGetAddress).toBeCallableWith('a1');
  });

  it('adds resetPage only for paginated slots', () => {
    expectTypeOf(slice.actions.resetGetItemsPage).toBeCallableWith();
    expectTypeOf<Has<typeof slice.actions, 'resetGetProfilePage'>>().toEqualTypeOf<false>();
    expectTypeOf<Has<typeof slice.actions, 'resetGetAddressPage'>>().toEqualTypeOf<false>();
  });

  it('keeps user reducers typed alongside the generated ones', () => {
    const withReducers = thunkEase({
      name: 'u',
      initialState: { count: 0 },
      thunks: { getProfile },
      reducers: {
        addTo(state, action: { payload: number; type: string }) {
          state.count += action.payload;
        }
      }
    });

    expectTypeOf(withReducers.actions.addTo).toBeCallableWith(3);
    expectTypeOf(withReducers.actions.resetGetProfile).toBeCallableWith();
  });
});
