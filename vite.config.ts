import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

// GitHub Pages 项目站点固定部署在 /image-resizer-2048/ 子路径
// base 必须为绝对子路径，BrowserRouter basename 同步使用 import.meta.env.BASE_URL
export default defineConfig({
  base: '/image-resizer-2048/',
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
  },
  optimizeDeps: {
    exclude: ['@jsquash/jpeg', '@jsquash/png', '@jsquash/resize', '@jsquash/webp'],
  },
  build: {
    target: 'es2022',
    sourcemap: false,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('@jsquash/jpeg')) return 'jsquash-jpeg';
          if (id.includes('@jsquash/png')) return 'jsquash-png';
          if (id.includes('@jsquash/resize')) return 'jsquash-resize';
          if (id.includes('@jsquash/webp')) return 'jsquash-webp';
          if (id.includes('node_modules/react') || id.includes('node_modules/react-dom') || id.includes('react-router')) return 'vendor-react';
        },
      },
    },
  },
});
