import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import fs from 'node:fs';
import path from 'node:path';
import {defineConfig, type Plugin} from 'vite';

/**
 * Build id unik per deploy. Dipakai untuk:
 * - menyuntik `__BUILD_ID__` ke bundle aplikasi,
 * - menstempel `dist/sw.js` sehingga byte-nya SELALU berubah tiap deploy
 *   (tanpa ini, browser tidak pernah mendeteksi service worker baru dan
 *   PWA terinstal terjebak di versi lama).
 */
function resolveBuildId(): string {
  const sha = (process.env.VERCEL_GIT_COMMIT_SHA || '').slice(0, 8);
  const stamp = Date.now().toString(36);
  return sha ? `${stamp}-${sha}` : stamp;
}

function buildIdPlugin(buildId: string): Plugin {
  return {
    name: 'gehc-build-id',
    closeBundle() {
      // sw.js memakai token `__BUILD_ID__` di dalam string literal.
      const swPath = path.resolve(__dirname, 'dist', 'sw.js');
      try {
        if (fs.existsSync(swPath)) {
          const src = fs.readFileSync(swPath, 'utf8');
          if (src.includes('__BUILD_ID__')) {
            fs.writeFileSync(swPath, src.replaceAll('__BUILD_ID__', buildId), 'utf8');
          }
        }
      } catch (err) {
        this.warn(`Gagal menstempel sw.js: ${err instanceof Error ? err.message : String(err)}`);
      }

      // pwa-register.js: suntikkan baris assignment di paling atas file.
      const regPath = path.resolve(__dirname, 'dist', 'pwa-register.js');
      try {
        if (fs.existsSync(regPath)) {
          const src = fs.readFileSync(regPath, 'utf8').replace(/^\uFEFF/, '');
          if (!src.startsWith('self.__GEHC_BUILD_ID__ =')) {
            fs.writeFileSync(regPath, `self.__GEHC_BUILD_ID__ = '${buildId}';\n${src}`, 'utf8');
          }
        }
      } catch (err) {
        this.warn(`Gagal menstempel pwa-register.js: ${err instanceof Error ? err.message : String(err)}`);
      }
    },
  };
}

export default defineConfig(() => {
  const buildId = resolveBuildId();
  return {
    plugins: [react(), tailwindcss(), buildIdPlugin(buildId)],
    define: {
      __BUILD_ID__: JSON.stringify(buildId),
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    optimizeDeps: {
      include: ['react', 'react-dom', 'react-dom/client'],
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modify - file watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
      // Proxy API ke backend Express lokal (npm run server)
      proxy: {
        '/api': {
          target: process.env.API_PROXY_TARGET || 'http://localhost:8787',
          changeOrigin: true,
        },
      },
    },
  };
});
