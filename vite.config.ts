import { defineConfig, searchForWorkspaceRoot } from 'vite';
import { existsSync } from 'node:fs';
import path from 'path';

const levelsDir = path.resolve(process.env.COFFEE_LEVELS_DIR || '../coffee-levels/publish');
const levelFiles = ['match3.json', 'falling.json', 'story.json'];

export default defineConfig(({ mode }) => {
  const files = Object.fromEntries(levelFiles.map(file => [file,
    mode === 'e2e' && file === 'story.json'
      ? path.resolve('tests/fixtures', file)
      : path.join(levelsDir, file)
  ]));
  return {
    root: '.',
    plugins: [
      {
        name: 'coffee-levels',
        buildStart() {
          const missing = Object.keys(files).filter(file => !existsSync(files[file]));
          if (missing.length) {
            this.error(`Missing ${missing.join(', ')} in ${levelsDir}. Clone coffee-levels next to coffee-in-a-row or set COFFEE_LEVELS_DIR to its publish directory.`);
          }
        }
      },
      { name: 'build-id', transformIndexHtml(html) { return html.replaceAll('__WEB_BUILD__', new Date().toISOString()); } }
    ],
    base: './',
    publicDir: 'public',
    build: {
      outDir: 'dist',
      target: 'chrome102',
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
      open: mode !== 'e2e',
      host: 'localhost',
      fs: { allow: [searchForWorkspaceRoot(process.cwd()), levelsDir] }
    },
    resolve: {
      alias: {
        ...Object.fromEntries(Object.entries(files).map(([file, source]) => [`@game/levels/${file}`, source])),
        '@': path.resolve(__dirname, './src'),
        '@game': path.resolve(__dirname, './src/game'),
        '@services': path.resolve(__dirname, './src/services'),
        '@ui': path.resolve(__dirname, './src/ui')
      }
    },
    optimizeDeps: {
      include: ['phaser']
    }
  };
});
