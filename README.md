# rtk-thunkease

Redux Toolkit's `createSlice`, minus the async boilerplate.

Hand it a record of `createAsyncThunk`s and it generates, for each one, a
`{ data, isLoading, error, status, isFetchedOnce }` slot, the full
pending/rejected/fulfilled triad, and `reset` / `invalidate` actions — all fully
typed from the thunk's payload.

```bash
npm i rtk-thunkease
```

Peer dependency: `@reduxjs/toolkit` v2. Zero runtime dependencies.

## Before / after

```ts
// Plain Redux Toolkit
const slice = createSlice({
  name: 'user',
  initialState: {
    profile: { data: undefined, isLoading: false, error: undefined, status: 'Idle', isFetchedOnce: false }
  },
  reducers: {
    resetProfile(state) {
      state.profile = { data: undefined, isLoading: false, error: undefined, status: 'Idle', isFetchedOnce: false };
    }
  },
  extraReducers: (builder) => {
    builder
      .addCase(getProfile.pending, (state) => {
        state.profile.status = 'Loading';
        state.profile.isLoading = true;
      })
      .addCase(getProfile.rejected, (state, action) => {
        state.profile.status = 'Failed';
        state.profile.isLoading = false;
        state.profile.error = action.error;
      })
      .addCase(getProfile.fulfilled, (state, action) => {
        state.profile.status = 'Succeeded';
        state.profile.isLoading = false;
        state.profile.error = undefined;
        state.profile.isFetchedOnce = true;
        state.profile.data = action.payload;
      });
  }
});
```

```ts
// rtk-thunkease
const slice = thunkEase({
  name: 'user',
  thunks: { getProfile }
});
```

Both give you `state.user.getProfile.isLoading` and a reset action. The second
one scales to twenty thunks without growing.

## The four modes

The thunk key's suffix picks how its state is shaped. The suffix is stripped to
get the state key, so `getOrders$items` fills `state.getOrders`.

| Thunk key | State shape | On fulfilled |
| --- | --- | --- |
| `getProfile` | `ApiState<T>` | `data` replaced |
| `getOrders$items` | `ApiState<T>` | `payload.items` appended onto `data.items` |
| `getAddress_addressId` | `HashMapApiState<T>` | bucket at `meta.arg.addressId` replaced |
| `getLandingRow_` | `HashMapApiState<T>` | bucket at the whole `meta.arg` replaced |

```ts
const slice = thunkEase({
  name: 'user',
  thunks: {
    getProfile,
    getOrders$items: getOrders,
    getAddress_addressId: getAddress,
    getLandingRow_: getLandingRow
  }
});

// state.user.getProfile             -> ApiState<Profile>
// state.user.getOrders.data.items   -> every page fetched so far, concatenated
// state.user.getAddress['a-1']      -> ApiState<Address> | undefined
// state.user.getLandingRow['row-7'] -> ApiState<Row> | undefined
```

`_` is checked before `$`, so a key containing both is treated as a hash map.
`_` and `$` are therefore reserved — a thunk key cannot use them for anything
else.

### Paginated mode appends blindly

`getOrders$items` concatenates `payload.items` onto whatever is already in
`data.items`. There is no page tracking and no de-duplication, so dispatching the
same page twice stores its rows twice. Dispatch `resetGetOrdersPage()` before
re-fetching from the start, or de-duplicate in your selector.

## Generated actions

Every thunk gets two actions; paginated thunks get a third.

| Action | Effect |
| --- | --- |
| `reset<Name>()` | slot back to its initial idle value |
| `invalidate<Name>()` | `status` back to `'Idle'`, `data` and `isFetchedOnce` kept |
| `reset<Name>Page()` | paginated only: empties the appended array, keeps the rest of `data` |

For hash-map thunks both take an optional key:

```ts
dispatch(slice.actions.resetGetAddress('a-1')); // drop one bucket
dispatch(slice.actions.resetGetAddress());      // drop every bucket
dispatch(slice.actions.invalidateGetAddress()); // every bucket back to Idle, data kept
```

`invalidate` exists for the common "fetch once when it scrolls into view" guard:

```ts
useEffect(() => {
  if (inView && status === 'Idle') dispatch(getProfile());
}, [inView, status]);

// later, to force a refetch without flashing empty UI:
dispatch(slice.actions.invalidateGetProfile());
```

A name collision between one of these and your own reducer throws at slice
construction rather than silently overwriting.

## Status values

```ts
type AsyncThunkStatus = 'Idle' | 'Loading' | 'Failed' | 'Succeeded';
```

Compare against the literals or use the exported constant:

```ts
import { AsyncThunkStatuses } from 'rtk-thunkease';

if (status === AsyncThunkStatuses.SUCCEEDED) { /* ... */ }
```

`data` starts as `{}` rather than `undefined`, so `state.getProfile.data.items`
does not throw before the first fetch. It is still typed `T | undefined`, because
after the first fulfilled action it holds a real payload.

## React hooks

The `rtk-thunkease/react` entry point adds two hooks. They need `react` and
`react-redux`; the core entry point does not.

```tsx
import { useApiState, useHashApiState } from 'rtk-thunkease/react';

function Profile() {
  const { data, isLoading, isIdle, isError } = useApiState((s: RootState) => s.user.getProfile);
  // ...
}

function Address({ addressId }: { addressId: string }) {
  const { data, isLoading } = useHashApiState((s: RootState) => s.user.getAddress, addressId);
  // ...
}
```

Both add `isIdle`, `isSuccess` and `isError` to the slot, and read a missing slot
or an unfetched bucket as idle — so there is nothing to guard before
destructuring.

## Options

```ts
thunkEase({
  name,           // slice name, as in createSlice
  thunks,         // record of createAsyncThunk results, keyed by state slot
  initialState,   // optional extra state alongside the generated slots
  reducers,       // optional case reducers of your own
  extraReducers   // optional builder callback, runs after the generated cases
});
```

`initialState` is merged underneath the generated slots, so you can seed
`data` for a slot and still get its skeleton:

```ts
thunkEase({
  name: 'user',
  initialState: { sidebarOpen: false, getProfile: { data: cachedProfile } },
  thunks: { getProfile }
});
```

`extraReducers` runs after the generated cases. Adding a case for a thunk that
is already in `thunks` throws, because Redux Toolkit rejects two reducers for one
action type — use it for actions the thunks do not cover, such as
`persist/REHYDRATE`.

`reducers` takes the plain `(state, action) => void` form. The
`{ reducer, prepare }` form is not typed here; reach for `extraReducers` or plain
`createSlice` if you need a `prepare` callback.

## Exports

| Export | |
| --- | --- |
| `thunkEase` | the slice factory |
| `createSliceWithThunks` | alias of `thunkEase` |
| `AsyncThunkStatuses` | the four status strings |
| `createInitialApiState` | a fresh idle `ApiState`, useful as a selector fallback |
| `ApiState`, `HashMapApiState`, `AsyncThunkStatus` | state types |
| `ConvertedThunks`, `PureStateName`, `GetAsyncThunkReturnType` | type helpers |
| `ThunkEaseOptions`, `ThunkEaseSlice`, `GeneratedCaseReducers` | signature types |
| `useApiState`, `useHashApiState`, `ApiStateView` | from `rtk-thunkease/react` |

## License

MIT
