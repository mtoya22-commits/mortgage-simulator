/// <reference types="vitest/config" />
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

// base: './' — 相対パス出力。サブディレクトリ / iframe 公開を前提にする
// （DESIGN_HANDOFF.md 6章）。GitHub Pages のプロジェクトサイトでも崩れない。
export default defineConfig({
  base: './',
  plugins: [react()],
  test: {
    globals: true,
    environment: 'node',
  },
});
