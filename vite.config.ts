import { defineConfig, searchForWorkspaceRoot } from 'vite';
import { createCipheriv, randomBytes } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import path from 'path';
import { bonusStoryAsset, promoCodePattern } from './src/game/levels/promoCode';

function encryptBonusStory(source: string, code: string): Buffer {
  if (!promoCodePattern.test(code)) throw Error('COFFEE_CAMPAIGN_PROMO_CODE must be a random 32-character hexadecimal code');
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-128-gcm', Buffer.from(code, 'hex'), iv);
  return Buffer.concat([iv, cipher.update(readFileSync(source)), cipher.final(), cipher.getAuthTag()]);
}

const levelsDir = path.resolve(process.env.COFFEE_LEVELS_DIR || '../coffee-levels/publish');
const storyFiles = ['story.json', 'shady-souls.json', 'story-challenges.mjs'];
const levelFiles = ['match3.json', 'falling.json', ...storyFiles];

export default defineConfig(({ mode }) => {
  const files = Object.fromEntries(levelFiles.map(file => [file,
    mode === 'e2e' && storyFiles.includes(file)
      ? path.resolve('tests/fixtures', file)
      : path.join(levelsDir, file)
  ]));
  const bonusSource = mode === 'e2e' ? path.resolve('tests/fixtures/bonus-story.json') : path.resolve(levelsDir, '../restricted/bonus-story.json');
  const bonusCode = mode === 'e2e' ? 'b0783d914560ee2a1b64b1dab15f375b' : process.env.COFFEE_CAMPAIGN_PROMO_CODE?.trim();
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
      {
        name: 'encrypted-campaign',
        configureServer(server) {
          if (!bonusCode) return;
          const encrypted = encryptBonusStory(bonusSource, bonusCode);
          server.middlewares.use('/' + bonusStoryAsset, (_request, response) => {
            response.setHeader('Content-Type', 'application/octet-stream');
            response.end(encrypted);
          });
        },
        generateBundle() {
          if (!bonusCode && !existsSync(bonusSource)) return;
          if (!bonusCode) this.error('Set COFFEE_CAMPAIGN_PROMO_CODE to publish the restricted campaign.');
          if (!existsSync(bonusSource)) this.error('Missing restricted campaign in coffee-levels.');
          this.emitFile({ type: 'asset', fileName: bonusStoryAsset, source: encryptBonusStory(bonusSource, bonusCode) });
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
