import { createAsyncThunk } from '@reduxjs/toolkit';

import { apiGet, type Post, type PostPage, type User } from '../api';

const PAGE_SIZE = 5;

/** Single mode: every fulfilled call replaces `data`. */
export const getPost = createAsyncThunk('posts/getPost', (postId: number, { signal }) =>
  apiGet<Post>(`/posts/${postId}`, signal)
);

/** Paginated mode: `payload.items` is appended onto `data.items`. */
export const getPosts = createAsyncThunk(
  'posts/getPosts',
  async (page: number, { signal }): Promise<PostPage> => {
    const items = await apiGet<Post[]>(`/posts?_page=${page}&_limit=${PAGE_SIZE}`, signal);
    return { items, page };
  }
);

/** Hash-map mode: the bucket key is read off `meta.arg.userId`. */
export const getUser = createAsyncThunk('posts/getUser', ({ userId }: { userId: number }, { signal }) =>
  apiGet<User>(`/users/${userId}`, signal)
);
