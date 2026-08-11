import { thunkEase } from 'rtk-thunkease';

import { getPost, getPosts, getUser } from './thunks';

/**
 * One call replaces the `extraReducers` triad for all three thunks.
 *
 * Key suffixes pick the state shape:
 *   getPost        -> state.posts.getPost            : ApiState<Post>
 *   getPosts$items -> state.posts.getPosts.data.items: every page, concatenated
 *   getUser_userId -> state.posts.getUser[userId]    : ApiState<User> | undefined
 */
export const postsSlice = thunkEase({
  name: 'posts',
  thunks: {
    getPost,
    getPosts$items: getPosts,
    getUser_userId: getUser
  }
});

export const { resetGetPost, invalidateGetPost, resetGetPostsPage, resetGetUser } = postsSlice.actions;
