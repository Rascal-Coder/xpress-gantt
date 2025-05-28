import { resolve } from 'node:path';
import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    lib: {
      entry: resolve(__dirname, 'src/index.ts'),
      name: 'Gantt',
      fileName: 'xpress-gantt',
    },
    rollupOptions: {
      output: {
        format: 'cjs',
        assetFileNames: 'xpress-gantt[extname]',
        entryFileNames: 'xpress-gantt.[format].js',
      },
    },
  },
  output: { interop: 'auto' },
  server: { watch: { include: ['dist/*', 'src/*'] } },
});
