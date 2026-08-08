import { configureStore, createAction, createAsyncThunk } from '@reduxjs/toolkit';
import { describe, expect, it } from 'vitest';

import { thunkEase } from './thunkEase';
import { AsyncThunkStatuses } from './types';

const { IDLE, LOADING, FAILED, SUCCEEDED } = AsyncThunkStatuses;

interface Profile {
  id: string;
  name: string;
}

const getProfile = createAsyncThunk('test/getProfile', async (arg: { fail?: boolean } | undefined) => {
  if (arg?.fail) throw new Error('boom');
  return { id: 'u1', name: 'Ada' } satisfies Profile;
});

const getItems = createAsyncThunk('test/getItems', async (page: number) => ({
  total: 10,
  items: [`item-${page}`]
}));

const getAddress = createAsyncThunk('test/getAddress', async (arg: { addressId: string; fail?: boolean }) => {
  if (arg.fail) throw new Error('boom');
  return { city: `city-${arg.addressId}` };
});

const getLandingRow = createAsyncThunk('test/getLandingRow', async (rowId: string) => ({ rowId }));

function makeStore() {
  const slice = thunkEase({
    name: 'test',
    initialState: { unrelated: 'kept' },
    thunks: {
      getProfile,
      getItems$items: getItems,
      getAddress_addressId: getAddress,
      getLandingRow_: getLandingRow
    }
  });

  const store = configureStore({ reducer: slice.reducer });
  return { slice, store, state: () => store.getState() };
}

describe('initial state', () => {
  it('seeds one idle slot per thunk and keeps unrelated keys', () => {
    const { state } = makeStore();

    expect(state().unrelated).toBe('kept');
    expect(state().getProfile).toEqual({
      data: {},
      isLoading: false,
      error: undefined,
      status: IDLE,
      isFetchedOnce: false
    });
    expect(state().getItems).toMatchObject({ status: IDLE });
  });

  it('starts hash-map slots empty', () => {
    const { state } = makeStore();

    expect(state().getAddress).toEqual({});
    expect(state().getLandingRow).toEqual({});
  });

  it('lets initialState seed data that the generated skeleton fills in around', () => {
    const slice = thunkEase({
      name: 'seeded',
      initialState: { getProfile: { data: { id: 'seed', name: 'seed' } } },
      thunks: { getProfile }
    });
    const store = configureStore({ reducer: slice.reducer });

    expect(store.getState().getProfile.data).toEqual({ id: 'seed', name: 'seed' });
    expect(store.getState().getProfile.status).toBe(IDLE);
  });

  it('does not mutate the caller initialState object', () => {
    const initialState = { nested: { count: 0 } };
    const slice = thunkEase({ name: 'frozen', initialState, thunks: { getProfile } });
    const store = configureStore({ reducer: slice.reducer });

    store.dispatch(slice.actions.resetGetProfile());

    expect(Object.isFrozen(initialState.nested)).toBe(false);
    expect(initialState.nested.count).toBe(0);
  });
});

describe('single mode', () => {
  it('walks pending -> fulfilled', async () => {
    const { store, state } = makeStore();

    const promise = store.dispatch(getProfile(undefined));
    expect(state().getProfile).toMatchObject({ status: LOADING, isLoading: true });

    await promise;
    expect(state().getProfile).toMatchObject({
      status: SUCCEEDED,
      isLoading: false,
      isFetchedOnce: true,
      error: undefined,
      data: { id: 'u1', name: 'Ada' }
    });
  });

  it('keeps data and isFetchedOnce when a later call rejects', async () => {
    const { store, state } = makeStore();

    await store.dispatch(getProfile(undefined));
    await store.dispatch(getProfile({ fail: true }));

    expect(state().getProfile).toMatchObject({
      status: FAILED,
      isLoading: false,
      isFetchedOnce: true,
      data: { id: 'u1', name: 'Ada' }
    });
    expect(state().getProfile.error?.message).toBe('boom');
  });
});

describe('paginated mode', () => {
  it('appends the named field across pages and keeps the rest of the payload', async () => {
    const { store, state } = makeStore();

    await store.dispatch(getItems(1));
    expect(state().getItems.data).toEqual({ total: 10, items: ['item-1'] });

    await store.dispatch(getItems(2));
    expect(state().getItems.data).toEqual({ total: 10, items: ['item-1', 'item-2'] });
  });

  it('duplicates rows when the same page is dispatched twice', async () => {
    const { store, state } = makeStore();

    await store.dispatch(getItems(1));
    await store.dispatch(getItems(1));

    expect(state().getItems.data?.items).toEqual(['item-1', 'item-1']);
  });
});

describe('hash-map mode', () => {
  it('keys buckets by meta.arg[argKey] and keeps buckets independent', async () => {
    const { store, state } = makeStore();

    await store.dispatch(getAddress({ addressId: 'a1' }));
    await store.dispatch(getAddress({ addressId: 'a2', fail: true }));

    expect(state().getAddress.a1).toMatchObject({ status: SUCCEEDED, data: { city: 'city-a1' } });
    expect(state().getAddress.a2).toMatchObject({ status: FAILED, isLoading: false });
  });

  it('preserves a bucket data when that bucket later rejects', async () => {
    const { store, state } = makeStore();

    await store.dispatch(getAddress({ addressId: 'a1' }));
    await store.dispatch(getAddress({ addressId: 'a1', fail: true }));

    expect(state().getAddress.a1).toMatchObject({
      status: FAILED,
      isFetchedOnce: true,
      data: { city: 'city-a1' }
    });
  });

  it('keys by the whole meta.arg for a bare trailing underscore', async () => {
    const { store, state } = makeStore();

    const promise = store.dispatch(getLandingRow('row-7'));
    expect(state().getLandingRow['row-7']).toMatchObject({ status: LOADING });

    await promise;
    expect(state().getLandingRow['row-7']).toMatchObject({ status: SUCCEEDED, data: { rowId: 'row-7' } });
  });
});

describe('generated reset / invalidate actions', () => {
  it('resets a single slot to idle and clears data', async () => {
    const { slice, store, state } = makeStore();

    await store.dispatch(getProfile(undefined));
    store.dispatch(slice.actions.resetGetProfile());

    expect(state().getProfile).toEqual({
      data: {},
      isLoading: false,
      error: undefined,
      status: IDLE,
      isFetchedOnce: false
    });
  });

  it('invalidate returns a slot to idle but keeps data and isFetchedOnce', async () => {
    const { slice, store, state } = makeStore();

    await store.dispatch(getProfile(undefined));
    store.dispatch(slice.actions.invalidateGetProfile());

    expect(state().getProfile).toMatchObject({
      status: IDLE,
      isLoading: false,
      isFetchedOnce: true,
      data: { id: 'u1', name: 'Ada' }
    });
  });

  it('clears only the accumulated page array', async () => {
    const { slice, store, state } = makeStore();

    await store.dispatch(getItems(1));
    await store.dispatch(getItems(2));
    store.dispatch(slice.actions.resetGetItemsPage());

    expect(state().getItems.data).toEqual({ total: 10, items: [] });
    expect(state().getItems.status).toBe(SUCCEEDED);
  });

  it('drops one hash-map bucket by key and leaves the others', async () => {
    const { slice, store, state } = makeStore();

    await store.dispatch(getAddress({ addressId: 'a1' }));
    await store.dispatch(getAddress({ addressId: 'a2' }));
    store.dispatch(slice.actions.resetGetAddress('a1'));

    expect(state().getAddress.a1).toBeUndefined();
    expect(state().getAddress.a2).toMatchObject({ status: SUCCEEDED });
  });

  it('drops every hash-map bucket when called without a key', async () => {
    const { slice, store, state } = makeStore();

    await store.dispatch(getAddress({ addressId: 'a1' }));
    store.dispatch(slice.actions.resetGetAddress());

    expect(state().getAddress).toEqual({});
  });

  it('invalidates every hash-map bucket when called without a key', async () => {
    const { slice, store, state } = makeStore();

    await store.dispatch(getAddress({ addressId: 'a1' }));
    await store.dispatch(getAddress({ addressId: 'a2' }));
    store.dispatch(slice.actions.invalidateGetAddress());

    expect(state().getAddress.a1).toMatchObject({ status: IDLE, data: { city: 'city-a1' } });
    expect(state().getAddress.a2).toMatchObject({ status: IDLE, data: { city: 'city-a2' } });
  });

  it('invalidates a single hash-map bucket by key', async () => {
    const { slice, store, state } = makeStore();

    await store.dispatch(getAddress({ addressId: 'a1' }));
    await store.dispatch(getAddress({ addressId: 'a2' }));
    store.dispatch(slice.actions.invalidateGetAddress('a1'));

    expect(state().getAddress.a1).toMatchObject({ status: IDLE });
    expect(state().getAddress.a2).toMatchObject({ status: SUCCEEDED });
  });

  it('is a no-op on an unknown hash-map key', () => {
    const { slice, store, state } = makeStore();

    store.dispatch(slice.actions.invalidateGetAddress('nope'));
    store.dispatch(slice.actions.resetGetAddress('nope'));

    expect(state().getAddress).toEqual({});
  });
});

describe('user reducers and extraReducers', () => {
  it('runs user reducers alongside the generated ones', () => {
    const slice = thunkEase({
      name: 'withReducers',
      initialState: { count: 0 },
      thunks: { getProfile },
      reducers: {
        increment(state) {
          state.count += 1;
        }
      }
    });
    const store = configureStore({ reducer: slice.reducer });

    store.dispatch(slice.actions.increment());

    expect(store.getState().count).toBe(1);
    expect(typeof slice.actions.resetGetProfile).toBe('function');
  });

  it('handles non-thunk actions registered in extraReducers', () => {
    const rehydrate = createAction<{ count: number }>('persist/REHYDRATE');

    const slice = thunkEase({
      name: 'withExtra',
      initialState: { count: 0 },
      thunks: { getProfile },
      extraReducers: (builder) => {
        builder.addCase(rehydrate, (state, action) => {
          state.count = action.payload.count;
        });
      }
    });
    const store = configureStore({ reducer: slice.reducer });

    store.dispatch(rehydrate({ count: 42 }));

    expect(store.getState().count).toBe(42);
    expect(store.getState().getProfile.status).toBe(IDLE);
  });

  it('works with no thunks at all', () => {
    const slice = thunkEase({
      name: 'empty',
      initialState: { count: 0 },
      thunks: {},
      reducers: {
        bump(state) {
          state.count += 1;
        }
      }
    });
    const store = configureStore({ reducer: slice.reducer });

    store.dispatch(slice.actions.bump());

    expect(store.getState()).toEqual({ count: 1 });
  });
});

describe('construction-time errors', () => {
  it('rejects a thunk key ending in a bare $', () => {
    expect(() =>
      thunkEase({ name: 'bad', thunks: { getItems$: getItems } })
    ).toThrowError(/names no field to append into/);
  });

  it('rejects a reducer name that collides with a generated action', () => {
    expect(() =>
      thunkEase({
        name: 'bad',
        thunks: { getProfile },
        reducers: {
          resetGetProfile(state) {
            void state;
          }
        }
      })
    ).toThrowError(/collides with an action generated/);
  });

  it('rejects two thunk keys that disagree on one slot shape', () => {
    expect(() =>
      thunkEase({ name: 'bad', thunks: { getItems: getItems, getItems$items: getItems } })
    ).toThrowError(/disagree on its shape/);
  });
});
