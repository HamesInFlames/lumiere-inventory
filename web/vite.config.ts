import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// In dev, proxy API/webhook/SSE calls to the Fastify server on :3000.
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': { target: 'http://localhost:3000', changeOrigin: true },
      '/webhook': { target: 'http://localhost:3000', changeOrigin: true },
    },
  },
  build: { outDir: 'dist' },
});
