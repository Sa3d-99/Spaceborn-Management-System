import { fileURLToPath } from 'node:url';
import { defineConfig, loadEnv, transformWithOxc } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

const envDir = fileURLToPath(new URL('../', import.meta.url));

// Some existing React components use JSX in .js files.
const jsxInJavaScript = {
  name: 'spaceborn-jsx-in-javascript',
  enforce: 'pre',
  transform(code, id) {
    if (id.includes('/src/') && id.endsWith('.js')) {
      return transformWithOxc(code, id, { lang: 'jsx', jsx: { runtime: 'automatic' } });
    }
  },
};

export default defineConfig(({ mode }) => ({
  plugins: [jsxInJavaScript, react(), tailwindcss()],
  envDir,
  envPrefix: 'REACT_APP_',
  define: {
    'process.env': JSON.stringify(loadEnv(mode, envDir, 'REACT_APP_')),
  },
  build: { outDir: 'build' },
  optimizeDeps: {
    rolldownOptions: { moduleTypes: { '.js': 'jsx' } },
  },
  server: {
    port: 3000,
    proxy: {
      '/api': 'http://127.0.0.1:5000',
      '/uploads': 'http://127.0.0.1:5000',
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: './src/setupTests.js',
  },
}));
