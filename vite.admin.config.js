// Build do /admin separado do site público: não toca nos chunks/hashes das páginas públicas.
import { resolve } from 'path';
import { defineConfig } from 'vite';

export default defineConfig({
  root: resolve(__dirname, 'admin'),
  base: '/admin/',
  publicDir: false,
  define: {
    // a anon key é pública por natureza (RLS protege os dados); a service_role nunca entra aqui
    __HUB_SUPABASE_URL__: JSON.stringify(process.env.SUPABASE_URL || ''),
    __HUB_SUPABASE_ANON_KEY__: JSON.stringify(process.env.SUPABASE_ANON_KEY || ''),
  },
  build: {
    outDir: resolve(__dirname, 'dist/admin'),
    emptyOutDir: true,
  },
});
