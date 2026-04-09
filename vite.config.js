import { resolve } from 'path'
import { fileURLToPath } from 'url'

const __dirname = fileURLToPath(new URL('.', import.meta.url))

export default {
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        projetos: resolve(__dirname, 'projetos.html'),
        projeto: resolve(__dirname, 'projeto.html'),
      },
    },
  },
}
