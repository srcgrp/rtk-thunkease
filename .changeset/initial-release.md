---
'rtk-thunkease': minor
---

First release.

`thunkEase` wraps `createSlice` and, for every thunk it is given, generates a
`{ data, isLoading, error, status, isFetchedOnce }` slot, the pending/rejected/
fulfilled triad, and `reset` / `invalidate` actions. Four modes, picked by the
thunk key's suffix: plain, `$field` (paginated append), `_argKey` (hash map) and
`_` (hash map keyed by the whole argument).

Optional React hooks — `useApiState` and `useHashApiState` — ship under
`rtk-thunkease/react`.
