import { resolve } from 'path';
import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        projeto: resolve(__dirname, 'projeto.html'),
        projetos: resolve(__dirname, 'projetos.html'),
      },
    },
  },
});
