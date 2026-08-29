import { copyFileSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { defineConfig } from 'vite';

const ROOT_STATIC_FILES = [
  'app.js',
  'sw.js',
  'style.css',
  'manifest.json',
  'icon.png',
  'apple-touch-icon.png',
  'apple-touch-icon-precomposed.png',
  'favicon.ico',
];

export default defineConfig({
  plugins: [
    {
      name: 'copy-root-static-files',
      closeBundle() {
        const outputDir = resolve('dist');
        mkdirSync(outputDir, { recursive: true });

        for (const file of ROOT_STATIC_FILES) {
          try {
            copyFileSync(resolve(file), resolve(outputDir, file));
          } catch (e) {
            console.warn('Could not copy', file, e.message);
          }
        }
      },
    },
  ],
});
