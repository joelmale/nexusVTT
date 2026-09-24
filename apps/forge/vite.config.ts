import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import federation from '@originjs/vite-plugin-federation';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const dirname = path.dirname(fileURLToPath(import.meta.url));
const characterCreatorSrc = path.resolve(
  dirname,
  '../../packages/character-creator/src',
);

const require = createRequire(import.meta.url);

// Get version from package.json for consistent versioning
const getVersion = () => {
  try {
    const pkg = require('./package.json');
    return pkg.version;
  } catch {
    return 'dev';
  }
};

// https://vitejs.dev/config/
export default defineConfig({
  base: '/forge/',
  plugins: [
    react(),
    federation({
      name: 'nexus_forge',
      filename: 'remoteEntry.js',
      exposes: {
        './CharacterSheet': './src/components/CharacterSheet/CharacterSheet.tsx',
        './dbService': './src/services/dbService.ts'
      },
      shared: ['react', 'react-dom', 'react-router-dom']
    })
  ],
  resolve: {
    alias: [
      // Build-time workspace import of the shared character creator. Keeping
      // this an alias (rather than a federated remote) means Forge and the VTT
      // compile the same source and share one rules implementation.
      {
        find: /^@nexus\/character-creator$/,
        replacement: path.join(characterCreatorSrc, 'index.ts'),
      },
      {
        find: /^@nexus\/character-creator\/(.*)$/,
        replacement: path.join(characterCreatorSrc, '$1'),
      },
    ],
  },
  define: {
    'import.meta.env.VITE_APP_VERSION': JSON.stringify(getVersion()),
  },
  server: {
    port: 3000,
    host: true,
    headers: {
      'Cross-Origin-Embedder-Policy': 'require-corp',
      'Cross-Origin-Opener-Policy': 'same-origin',
    }
  },
  optimizeDeps: {
    include: ['@3d-dice/dice-box']
  },
  build: {
    target: 'esnext',
    outDir: 'dist',
    sourcemap: false,
    minify: 'terser',
    reportCompressedSize: false, // Faster builds
    chunkSizeWarningLimit: 1000, // Reduce warnings
    terserOptions: {
      compress: {
        // drop_console: true, // Temporarily disabled for debugging
      },
    },
    rollupOptions: {
      output: {
        manualChunks(id) {
          // specific split for heavy 3D libraries (optional but recommended)
          if (id.includes('node_modules/three')) {
            return 'three';
          }
          if (id.includes('node_modules/@react-three')) {
            return 'react-three';
          }
          if (id.includes('node_modules/@3d-dice')) {
            return 'dice-3d';
          }
        },
      },
    },
  },
  esbuild: {
    // drop: ['console', 'debugger'], // Temporarily disabled for debugging
  },
});
