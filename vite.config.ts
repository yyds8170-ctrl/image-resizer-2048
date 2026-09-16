import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

// GitHub Pages 部署时，将 base 设为你的仓库名，例如 '/image-resizer-2048/'
// 本地开发或自定义域名部署时，保持 './'
export default defineConfig({
  base: './',
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
