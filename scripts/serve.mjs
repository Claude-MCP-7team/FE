import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { resolve, extname, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
export function createServer({ prototype = false, apiBase = process.env.YPC_API_BASE ?? null } = {}) {
const root = fileURLToPath(new URL('../', import.meta.url));
const shared = ['/profile.html', '/src/tokens.css', '/src/confidence.js', '/src/profile.js', '/src/profile-form.js', '/src/profile-page.js', '/src/profile.css', '/src/dom.js', '/src/profile-repository.js', '/src/judgement-api.js', '/src/judgement-contract.js', '/src/judgement-page.js', '/src/judgement-runner.js', '/src/question-api.js', '/src/question-contract.js', '/src/question-page.js', '/src/combination-api.js', '/src/combination-contract.js', '/src/combination-page.js'];
const allowed = new Set([...shared, '/src/profile-api.js', ...(prototype ? ['/index.html'] : ['/index.html', '/src/app.js', '/src/contracts.js', '/src/styles.css', '/src/page-loader.js', '/mocks/scenario.json'])]);
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json' };
return http.createServer(async (req, res) => {
  try {
    const pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
    const path = pathname === '/' ? '/index.html' : pathname;
    if (path === '/src/runtime-config.js') {
      res.writeHead(200, { 'Content-Type': 'text/javascript; charset=utf-8', 'Cache-Control': 'no-store' }).end(`export const apiBase = ${JSON.stringify(apiBase)};`);
      return;
    }
    if (!allowed.has(path)) { res.writeHead(404).end('Not found'); return; }
    const file = resolve(root, '.' + (prototype && path === '/index.html' ? '/prototype/index.html' : path));
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
