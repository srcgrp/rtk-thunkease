---
'rtk-thunkease': minor
---

Add `withTypes` to `useApiState` and `useHashApiState`.

TypeScript cannot infer the store's state from an unannotated selector, so
`useApiState((s) => s.user.getProfile)` left `s` as `unknown` and collapsed `data`
to `{}`. Pin the state type once instead, the same way react-redux does:

```ts
export const useApiState = useApiStateBase.withTypes<RootState>();
```

Existing annotated call sites keep working — the base signature is unchanged.
