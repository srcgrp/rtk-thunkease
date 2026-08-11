# rtk-thunkease demo

Live at <https://srcgrp.github.io/rtk-thunkease/>.

One `thunkEase` call in [`src/store/slice.ts`](src/store/slice.ts) covers all
three state shapes, against the public
[jsonplaceholder](https://jsonplaceholder.typicode.com) API:

| Slot | Mode | What the page shows |
| --- | --- | --- |
| `getPost` | single | each fetch replaces `data`; invalidate keeps it, reset drops it |
| `getPosts$items` | paginated | every page appends onto `data.items` |
| `getUser_userId` | hash map | one independent bucket per `userId` |

`src/store/hooks.ts` pins the state type once with `withTypes<RootState>()`, so
no selector in the page needs an annotation.

## Running it

From the repo root:

```bash
pnpm install
pnpm build                          # the library — the demo imports its dist
pnpm --filter rtk-thunkease-demo dev
```

`vite.config.ts` sets `base` to `/rtk-thunkease/` for GitHub Pages. Building for
anywhere else takes `BASE_PATH=/ pnpm --filter rtk-thunkease-demo build`.
