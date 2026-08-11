import { configureStore } from '@reduxjs/toolkit';

import { postsSlice } from './slice';

export const store = configureStore({
  reducer: {
    [postsSlice.name]: postsSlice.reducer
  }
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
