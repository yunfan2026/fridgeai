import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';

// The React app lives in ./web and builds to ./web/dist, which Express serves in production.
// In dev, Vite runs on 5173 and proxies /api/* to the Express server on 3000.
// envDir points at the repo root so VITE_* vars sit next to server env, not inside web/.
export default defineConfig({
  root: 'web',
  envDir: fileURLToPath(new URL('.', import.meta.url)),
  plugins: [react()],
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  },
  server: {
    port: 5173,
    proxy: {
      '/api': 'http://localhost:3000',
    },
  },
});
