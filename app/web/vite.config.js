import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    // Em dev, /api vai para a API local (mesma origem: o cookie SameSite=Strict funciona).
    proxy: { '/api': 'http://localhost:3000' },
  },
  build: {
    sourcemap: false, // não publica o código-fonte original em produção
  },
});
