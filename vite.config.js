import { defineConfig } from 'vite';

export default defineConfig({
  root: '.',
  server: {
    port: 3000,
    open: true
  },
  build: {
    outDir: 'dist',
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('@reown') || id.includes('@walletconnect')) {
            return 'wallet-vendors';
          }

          if (id.includes('@stacks') || id.includes('@wagmi') || id.includes('viem')) {
            return 'chain-vendors';
          }
        }
      }
    }
  },
  define: {
    // Polyfill for Node.js globals needed by some Stacks packages
    global: 'globalThis'
  }
});

// PR 0 build config tweak
