# rtk-thunkease

## 0.3.0

### Minor Changes

- 46bf2fe: Add `withTypes` to `useApiState` and `useHashApiState`.

  TypeScript cannot infer the store's state from an unannotated selector, so
  `useApiState((s) => s.user.getProfile)` left `s` as `unknown` and collapsed `data`
  to `{}`. Pin the state type once instead, the same way react-redux does:

  ```ts
  export const useApiState = useApiStateBase.withTypes<RootState>();
  ```

  Existing annotated call sites keep working — the base signature is unchanged.

## 0.2.0

### Minor Changes

- 082c210: First release.

  `thunkEase` wraps `createSlice` and, for every thunk it is given, generates a
  `{ data, isLoading, error, status, isFetchedOnce }` slot, the pending/rejected/
  fulfilled triad, and `reset` / `invalidate` actions. Four modes, picked by the
  thunk key's suffix: plain, `$field` (paginated append), `_argKey` (hash map) and
  `_` (hash map keyed by the whole argument).

  Optional React hooks — `useApiState` and `useHashApiState` — ship under
  `rtk-thunkease/react`.
