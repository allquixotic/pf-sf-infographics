import { cp, readdir, readFile, stat } from 'node:fs/promises';
import { extname, join, relative, resolve, sep } from 'node:path';
import vue from '@vitejs/plugin-vue';
import { defineConfig, type Plugin } from 'vite';

const repoRoot = resolve(import.meta.dirname, '../..');
const contentDir = join(repoRoot, 'content');
const localAssetsDir = join(repoRoot, 'local-assets');

const MIME: Record<string, string> = {
  '.json': 'application/json',
  '.svg': 'image/svg+xml',
  '.ttf': 'font/ttf',
  '.otf': 'font/otf',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.zip': 'application/zip',
  '.txt': 'text/plain; charset=utf-8',
  '.md': 'text/markdown; charset=utf-8',
};

/** Imports *.typ files as strings (the engine's Typst templates). */
function typstText(): Plugin {
  return {
    name: 'pfsf-typst-text',
    enforce: 'pre',
    async load(id) {
      const file = id.split('?')[0]!;
      if (!file.endsWith('.typ')) return null;
      return `export default ${JSON.stringify(await readFile(file, 'utf8'))};`;
    },
  };
}

/** Resolves `rel` inside `root`, refusing anything that escapes it. */
function safeJoin(root: string, rel: string): string | undefined {
  const full = resolve(root, decodeURIComponent(rel).replace(/^\/+/, ''));
  return full === root || full.startsWith(root + sep) ? full : undefined;
}

async function listFiles(dir: string): Promise<string[]> {
  const out: string[] = [];
  const walk = async (d: string) => {
    let entries: import('node:fs').Dirent[];
    try {
      entries = await readdir(d, { withFileTypes: true });
    } catch {
      return;
    }
    for (const e of entries) {
      if (e.name.startsWith('.')) continue;
      const p = join(d, e.name);
      if (e.isDirectory()) await walk(p);
      else out.push(relative(dir, p).split(sep).join('/'));
    }
  };
  await walk(dir);
  return out;
}

/**
 * Serves the repository's content/ folder at <base>content/ during development (live, so forks can edit content
 * without committing) and copies it into the build. In development only, it also exposes local-assets/ (Paizo
 * Community Use Package zips and extra art the user downloaded) so the local GUI finds them automatically. Those
 * files are never copied into a build.
 */
function contentFolder(): Plugin {
  let outDir = 'dist';
  return {
    name: 'pfsf-content-folder',
    configResolved(config) {
      outDir = resolve(config.root, config.build.outDir);
    },
    configureServer(server) {
      const base = server.config.base.replace(/\/$/, '');
      server.watcher.add(contentDir);
      server.watcher.on('change', (file) => {
        if (file.startsWith(contentDir))
          server.ws.send({ type: 'custom', event: 'pfsf:content-changed', data: {} });
      });
      server.middlewares.use(async (req, res, next) => {
        const url = (req.url ?? '').split('?')[0]!;
        const send = async (file: string | undefined) => {
          if (!file) return void res.writeHead(403).end();
          try {
            if (!(await stat(file)).isFile()) return next();
            res.setHeader('Content-Type', MIME[extname(file).toLowerCase()] ?? 'application/octet-stream');
            res.setHeader('Cache-Control', 'no-store');
            res.end(await readFile(file));
          } catch {
            res.writeHead(404).end();
          }
        };
        if (url.startsWith(`${base}/content/`))
          return send(safeJoin(contentDir, url.slice(`${base}/content/`.length)));
        if (url === `${base}/__local-assets/index.json`) {
          res.setHeader('Content-Type', 'application/json');
          return void res.end(JSON.stringify({ files: await listFiles(localAssetsDir) }));
        }
        if (url.startsWith(`${base}/__local-assets/`)) {
          return send(safeJoin(localAssetsDir, url.slice(`${base}/__local-assets/`.length)));
        }
        next();
      });
    },
    async closeBundle() {
      await cp(contentDir, join(outDir, 'content'), { recursive: true });
    },
  };
}

export default defineConfig(({ command }) => ({
  base: process.env.PFSF_BASE ?? '/',
  plugins: [typstText(), vue(), contentFolder()],
  define: {
    __PFSF_LOCAL__: JSON.stringify(command === 'serve'),
    __PFSF_REPO__: JSON.stringify(process.env.PFSF_REPO ?? ''),
    __PFSF_REF__: JSON.stringify(process.env.PFSF_REF ?? ''),
  },
  worker: { format: 'es', plugins: () => [typstText()] },
  optimizeDeps: {
    exclude: [
      '@myriaddreamin/typst.ts',
      '@myriaddreamin/typst-ts-web-compiler',
      '@myriaddreamin/typst-ts-renderer',
      '@resvg/resvg-wasm',
      '@jsquash/jpeg',
      '@jsquash/webp',
    ],
  },
  server: { host: '127.0.0.1', port: Number(process.env.PFSF_PORT ?? 5173), strictPort: false },
  build: {
    target: 'es2023',
    chunkSizeWarningLimit: 4000,
    rolldownOptions: {
      input: {
        app: resolve(import.meta.dirname, 'index.html'),
        privacy: resolve(import.meta.dirname, 'privacy/index.html'),
      },
    },
  },
}));
