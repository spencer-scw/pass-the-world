import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  base: process.env.VITE_BASE ?? '/',
  plugins: [react()],
  server: {
    // The API (wrangler dev or the Node server) runs on 8787 during development.
    proxy: { '/api': 'http://localhost:8787' },
  },
});
