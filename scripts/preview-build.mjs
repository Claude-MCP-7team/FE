import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { resolve, sep, extname } from 'node:path';
import { fileURLToPath } from 'node:url';

export function previewBuild({ root = fileURLToPath(new URL('../dist/', import.meta.url)), basePath = '/FE/' } = {}) {
  root = resolve(root);
  const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json' };
  return http.createServer(async (request, response) => {
    try {
      const path = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
      if (!path.startsWith(basePath)) { response.writeHead(404).end('Not found'); return; }
      const relative = path.slice(basePath.length) || 'index.html';
      const file = resolve(root, relative);
      if (!file.startsWith(root + sep) || !types[extname(file)]) { response.writeHead(404).end('Not found'); return; }
      const body = await readFile(file);
      response.writeHead(200, { 'Content-Type': `${types[extname(file)]}; charset=utf-8`, 'Cache-Control': 'no-store' }).end(body);
    } catch { response.writeHead(404).end('Not found'); }
  });
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const port = Number(process.env.YPC_PREVIEW_PORT || 5174);
  previewBuild().listen(port, '127.0.0.1', () => console.log(`Build preview: http://127.0.0.1:${port}/FE/`));
}
