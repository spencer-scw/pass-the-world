import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  base: process.env.VITE_BASE ?? '/',
  plugins: [react()],
  server: {
    // The API (wrangler dev or the Node server) runs on 8787 during development.
    // /join/<code> is the invite link's preview page, also served by the API host.
    proxy: { '/api': 'http://localhost:8787', '/join': 'http://localhost:8787' },
  },
});
