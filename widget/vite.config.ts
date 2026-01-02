import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { viteSingleFile } from 'vite-plugin-singlefile';
import { resolve } from 'path';

export default defineConfig({
  plugins: [
    react(),
    viteSingleFile(),
  ],
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    assetsInlineLimit: 100000000,
    cssCodeSplit: false,
    minify: 'esbuild',
    rollupOptions: {
      input: {
        'github-widget': resolve(__dirname, 'github-widget.html'),
        'pr-context-widget': resolve(__dirname, 'pr-context-widget.html'),
      },
    },
  },
  server: {
    port: 5174,
  },
});
