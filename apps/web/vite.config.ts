import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import path from 'path';

// Tauri builds set TAURI_BUILD=true; the dist output is then bundled into
// the desktop shell. Plain `vite build` is used for static web hosting.
const isTauriBuild = process.env.TAURI_BUILD === 'true';
const tauriDevHost = process.env.TAURI_DEV_HOST;

export default defineConfig({
  plugins: [
    react({
      babel: {
        plugins: [['babel-plugin-react-compiler', {}]],
      },
    }),
    tailwindcss(),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 3527,
    strictPort: true,
    host: isTauriBuild && tauriDevHost ? tauriDevHost : '127.0.0.1',
  },
  preview: {
    port: 3527,
    strictPort: true,
  },
  build: {
    outDir: 'dist',
  },
});
