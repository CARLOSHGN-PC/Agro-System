import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [react(), VitePWA()],
  server: {
    port: 5174,
    host: '0.0.0.0'
  },
  build: {
    rollupOptions: {
      input: {
        main: './index_test.html'
      }
    }
  }
});
