import { defineConfig } from 'vite';

export default defineConfig({
  root: '.',
  server: {
    port: 3000,
    open: true
  },
  build: {
    outDir: 'dist'
  },
  define: {
    // Polyfill for Node.js globals needed by some Stacks packages
    global: 'globalThis'
  }
});

// PR 0 build config tweak
