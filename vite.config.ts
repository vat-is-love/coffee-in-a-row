import { defineConfig } from 'vite';
import path from 'path';

export default defineConfig({
  root: '.',
  plugins: [{ name: 'build-id', transformIndexHtml(html) { return html.replace('__WEB_BUILD__', new Date().toISOString()); } }],
  base: './',
  publicDir: 'public',
  build: {
    outDir: 'dist',
    target: 'chrome102',
    sourcemap: true,
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_console: true,
        drop_debugger: true
      }
    },
    rollupOptions: {
      output: {
        manualChunks: {
          phaser: ['phaser']
        }
      }
    }
  },
  server: {
    port: 3000,
    open: true,
    host: true
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@game': path.resolve(__dirname, './src/game'),
      '@services': path.resolve(__dirname, './src/services'),
      '@ui': path.resolve(__dirname, './src/ui')
    }
  },
  optimizeDeps: {
    include: ['phaser']
  }
});