import { useDispatch, useSelector } from 'react-redux';
import { useApiState as useApiStateBase, useHashApiState as useHashApiStateBase } from 'rtk-thunkease/react';

import type { AppDispatch, RootState } from './index';

export const useAppDispatch = useDispatch.withTypes<AppDispatch>();
export const useAppSelector = useSelector.withTypes<RootState>();

/** Pinning the state type here keeps every selector below free of annotations. */
export const useApiState = useApiStateBase.withTypes<RootState>();
export const useHashApiState = useHashApiStateBase.withTypes<RootState>();
