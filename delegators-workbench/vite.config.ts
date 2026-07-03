import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import type { Plugin } from 'vite';
import { defineConfig } from 'vitest/config';

function blockLegacyTemplateGalleryPngs(): Plugin {
  return {
    name: 'block-legacy-template-gallery-pngs',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        if (req.url?.startsWith('/template-gallery/')) {
          res.statusCode = 410;
          res.setHeader('Content-Type', 'text/plain');
          res.end('Template gallery PNG previews removed. Use live slide render.');
          return;
        }
        next();
      });
    }
  };
}

export default defineConfig({
  plugins: [react(), tailwindcss(), blockLegacyTemplateGalleryPngs()],
  server: {
    proxy: {
      '/api': {
        target: process.env.WORKBENCH_API_URL ?? 'http://localhost:4175',
        changeOrigin: true
      }
    }
  },
  preview: {
    proxy: {
      '/api': {
        target: process.env.WORKBENCH_API_URL ?? 'http://localhost:4175',
        changeOrigin: true
      }
    }
  },
  // Real multi-page PDF/DOCX/PPTX generation in the exporter tests can exceed the
  // 5s default on slower CI runners; give them headroom so CI isn't flaky.
  test: {
    testTimeout: 20000
  }
});
