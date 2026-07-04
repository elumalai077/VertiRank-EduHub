import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/dashboard-proxy': {
        target: 'https://u5e067rz0k.execute-api.ap-south-1.amazonaws.com/default',
        changeOrigin: true,
        secure: false,
        rewrite: (path) => path.replace(/^\/dashboard-proxy/, '/dashboard'),
      },
    },
  },
});
