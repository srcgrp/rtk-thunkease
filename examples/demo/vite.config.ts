import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

/**
 * Served from https://srcgrp.github.io/rtk-thunkease/, so assets need the repo
 * name as their base. `BASE_PATH` lets a local `vite build` opt out.
 */
export default defineConfig({
  base: process.env.BASE_PATH ?? '/rtk-thunkease/',
  plugins: [react()]
});
