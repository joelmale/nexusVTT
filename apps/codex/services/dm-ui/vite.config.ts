import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@/components': path.resolve(__dirname, './src/components'),
      '@/lib': path.resolve(__dirname, './src/lib'),
      '@/hooks': path.resolve(__dirname, './src/hooks'),
      '@/types': path.resolve(__dirname, './src/types'),
      '@/db': path.resolve(__dirname, './src/db'),
      '@/stores': path.resolve(__dirname, './src/stores'),
      '@/services': path.resolve(__dirname, './src/services')
    }
  },
  optimizeDeps: {
    include: ['lexical', '@lexical/react', '@lexical/markdown'],
    esbuildOptions: {
      resolveExtensions: ['.js', '.ts', '.jsx', '.tsx', '.json']
    }
  },
  server: {
    host: '0.0.0.0',
    port: 3003,
    proxy: {
      '/api': {
        target: process.env.VITE_DOC_API_URL || 'http://localhost:3000',
        changeOrigin: true
      }
    }
  },
  build: {
    outDir: 'dist',
    sourcemap: true,
    commonjsOptions: {
      include: [/node_modules/],
      transformMixedEsModules: true
    },
    rollupOptions: {
      output: {
        manualChunks: {
          'react-vendor': ['react', 'react-dom', 'react-router-dom'],
          'db-vendor': ['dexie', 'dexie-react-hooks'],
          'form-vendor': ['react-hook-form', '@hookform/resolvers', 'zod'],
          'viz-vendor': ['d3'],
          'calendar-vendor': ['react-big-calendar', 'date-fns']
        }
      }
    }
  }
});
