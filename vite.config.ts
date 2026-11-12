import { defineConfig, searchForWorkspaceRoot } from 'vite';
import path from 'path';

const levelsDir = process.env.COFFEE_LEVELS_DIR && path.resolve(process.env.COFFEE_LEVELS_DIR);

export default defineConfig({
  root: '.',
  plugins: [{ name: 'build-id', transformIndexHtml(html) { return html.replaceAll('__WEB_BUILD__', new Date().toISOString()); } }],
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
    host: levelsDir ? 'localhost' : true,
    fs: levelsDir ? { allow: [searchForWorkspaceRoot(process.cwd()), levelsDir] } : undefined
  },
  resolve: {
    alias: {
      ...(levelsDir && {
        '@game/levels/match3.json': path.join(levelsDir, 'match3.json'),
        '@game/levels/falling.json': path.join(levelsDir, 'falling.json')
      }),
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
