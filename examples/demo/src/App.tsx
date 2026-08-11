import { useState } from 'react';

import { useApiState, useAppDispatch, useAppSelector, useHashApiState } from './store/hooks';
import { invalidateGetPost, resetGetPost, resetGetPostsPage, resetGetUser } from './store/slice';
import { getPost, getPosts, getUser } from './store/thunks';

/** `getPost` — single mode. Each fulfilled call replaces `data`. */
function SinglePost() {
  const dispatch = useAppDispatch();
  const [postId, setPostId] = useState(1);
  const { data, isLoading, isIdle, isError, error, status } = useApiState((s) => s.posts.getPost);

  return (
    <section>
      <h2>
        Single — <code>getPost</code>
      </h2>
      <p className="status">
        status: <code>{status}</code>
      </p>
      <div className="row">
        <button onClick={() => dispatch(getPost(postId))} disabled={isLoading}>
          {isLoading ? 'Loading…' : `Fetch post #${postId}`}
        </button>
        <button onClick={() => setPostId((id) => (id % 10) + 1)}>Next id</button>
        <button onClick={() => dispatch(invalidateGetPost())}>Invalidate</button>
        <button onClick={() => dispatch(resetGetPost())}>Reset</button>
      </div>
      {isIdle && <p className="muted">Idle — nothing fetched yet.</p>}
      {isError && <p className="error">Error: {error?.message}</p>}
      {data?.title && (
        <p>
          <strong>#{data.id}</strong> {data.title}
        </p>
      )}
    </section>
  );
}

/** `getPosts$items` — paginated mode. `payload.items` is appended onto `data.items`. */
function PaginatedPosts() {
  const dispatch = useAppDispatch();
  const { data, isLoading, status } = useApiState((s) => s.posts.getPosts);
  const items = data?.items ?? [];
  const nextPage = (data?.page ?? 0) + 1;

  return (
    <section>
      <h2>
        Paginated — <code>getPosts$items</code>
      </h2>
      <p className="status">
        status: <code>{status}</code> — {items.length} rows accumulated
      </p>
      <div className="row">
        <button onClick={() => dispatch(getPosts(nextPage))} disabled={isLoading}>
          {isLoading ? 'Loading…' : `Load page ${nextPage}`}
        </button>
        <button onClick={() => dispatch(resetGetPostsPage())}>Reset page</button>
      </div>
      <ul>
        {items.map((post, index) => (
          <li key={`${post.id}-${index}`}>{post.title}</li>
        ))}
      </ul>
    </section>
  );
}

/** `getUser_userId` — hash-map mode. One bucket per `meta.arg.userId`. */
function HashMapUser({ userId }: { userId: number }) {
  const dispatch = useAppDispatch();
  const { data, isLoading, isIdle } = useHashApiState((s) => s.posts.getUser, userId);

  return (
    <li className="row">
      <button onClick={() => dispatch(getUser({ userId }))} disabled={isLoading}>
        user {userId}
      </button>
      {isLoading && <span className="muted">loading…</span>}
      {isIdle && <span className="muted">idle</span>}
      {data?.name && (
        <span>
          {data.name} — {data.email}
        </span>
      )}
    </li>
  );
}

function HashMapUsers() {
  const dispatch = useAppDispatch();
  const buckets = useAppSelector((s) => Object.keys(s.posts.getUser).length);

  return (
    <section>
      <h2>
        Hash map — <code>getUser_userId</code>
      </h2>
      <p className="status">{buckets} bucket(s) in the slot</p>
      <ul className="plain">
        {[1, 2, 3].map((userId) => (
          <HashMapUser key={userId} userId={userId} />
        ))}
      </ul>
      <button onClick={() => dispatch(resetGetUser())}>Reset all buckets</button>
    </section>
  );
}

export default function App() {
  return (
    <main>
      <h1>rtk-thunkease</h1>
      <p className="muted">
        Three slots, three modes, one <code>thunkEase</code> call — see{' '}
        <code>src/store/slice.ts</code>. Data from{' '}
        <a href="https://jsonplaceholder.typicode.com">jsonplaceholder</a>.
      </p>
      <p>
        <a href="https://github.com/srcgrp/rtk-thunkease">GitHub</a> ·{' '}
        <a href="https://www.npmjs.com/package/rtk-thunkease">npm</a>
      </p>
      <SinglePost />
      <PaginatedPosts />
      <HashMapUsers />
    </main>
  );
}
