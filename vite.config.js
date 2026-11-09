import { defineConfig } from 'vite';

export default defineConfig({
  base: '/Qute/',
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    chunkSizeWarningLimit: 2500
  }
});
