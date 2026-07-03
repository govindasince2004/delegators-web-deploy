import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react-swc';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), 'VITE_');
  if (mode === 'production' && !env.VITE_CLERK_PUBLISHABLE_KEY) {
    throw new Error('VITE_CLERK_PUBLISHABLE_KEY is required for production client-site builds');
  }

  return {
  plugins: [tailwindcss(), react()],
  server: {
    port: 5174,
    proxy: {
      '/v1': {
        target: 'http://localhost:8080',
        changeOrigin: true,
      },
      '/gateway-payment': {
        target: 'http://localhost:8080',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/gateway-payment/, '/payment'),
      },
    },
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  },
};
});
