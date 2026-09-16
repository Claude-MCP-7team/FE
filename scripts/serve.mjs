import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { resolve, extname, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
export function createServer({ prototype = false } = {}) {
const root = fileURLToPath(new URL(prototype ? '../prototype/' : '../', import.meta.url));
const allowed = new Set(prototype ? ['/index.html'] : ['/index.html', '/src/app.js', '/src/contracts.js', '/src/styles.css', '/mocks/scenario.json', '/src/profile-api.js']);
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json' };
return http.createServer(async (req, res) => {
  try {
    const pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
    const path = pathname === '/' ? '/index.html' : pathname;
    if (!allowed.has(path)) { res.writeHead(404).end('Not found'); return; }
    const file = resolve(root, '.' + path);
    if (!file.startsWith(resolve(root) + sep)) { res.writeHead(404).end(); return; }
    const body = await readFile(file);
    res.writeHead(200, { 'Content-Type': types[extname(file)] + '; charset=utf-8', 'Cache-Control': 'no-store' }).end(body);
  } catch { res.writeHead(404).end('Not found'); }
});
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
const prototype = process.argv.includes('--prototype');
const port = prototype ? 4173 : 5173;
createServer({ prototype }).listen(port, '127.0.0.1', () => console.log(`YouthFit: http://127.0.0.1:${port}`));
}
