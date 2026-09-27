import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { createServer } from '../scripts/serve.mjs';

for (const prototype of [false, true]) {
  test(`${prototype ? 'prototype' : 'mock'} server only exposes approved assets`, async t => {
    const server = createServer({ prototype });
    server.listen(0, '127.0.0.1');
    await once(server, 'listening');
    t.after(() => new Promise(resolve => { server.close(resolve); server.closeAllConnections(); }));
    const base = `http://127.0.0.1:${server.address().port}`;
    const allowed = [...(prototype ? ['/', '/index.html'] : ['/', '/index.html', '/src/app.js', '/src/contracts.js', '/src/styles.css', '/src/page-loader.js', '/mocks/scenario.json']), '/src/dashboard.js', '/src/dashboard-template.js', '/src/dashboard.css', '/src/app.js', '/profile.html', '/src/tokens.css', '/src/confidence.js', '/src/profile.js', '/src/profile-form.js', '/src/profile-page.js', '/src/profile.css', '/src/dom.js', '/src/profile-api.js', '/src/profile-repository.js', '/src/runtime-config.js', '/src/judgement-api.js', '/src/judgement-contract.js', '/src/judgement-page.js'];
    for (const path of allowed) {
      const response = await fetch(base + path);
      assert.equal(response.status, 200, path);
      assert.ok((await response.text()).length > 0);
    }
    // Follow actual module imports so new dependencies cannot silently blank a page.
    const pending = allowed.filter(path => path.endsWith('.js'));
    const visited = new Set();
    while (pending.length) {
      const path = pending.pop();
      if (visited.has(path)) continue;
      visited.add(path);
      const response = await fetch(base + path);
      assert.equal(response.status, 200, `Module must be served: ${path}`);
      assert.match(response.headers.get('content-type'), /javascript/);
      const source = await response.text();
      for (const match of source.matchAll(/(?:import|export)\s+[^;]*?from\s+['"]([^'"]+)['"]/g)) {
        pending.push(new URL(match[1], base + path).pathname);
      }
    }
    for (const path of ['/package.json', '/tests/contracts.test.js', '/.env.json', '/scripts/serve.mjs', '/prototype/index.html', '/%2e%2e/package.json', '/src/%2e%2e/package.json', '/src%5c..%5cpackage.json', '/%ZZ']) {
      const response = await fetch(base + path);
      assert.equal(response.status, 404, path);
      await response.text();
    }
  });
}

test('runtime config defaults to drafts and safely serializes an explicit API address', async t => {
  for (const apiBase of [null, '', 'http://127.0.0.1:8000', 'https://example.test/";throw Error(1)//']) {
    const server = createServer({ apiBase });
    server.listen(0, '127.0.0.1'); await once(server, 'listening');
    t.after(() => new Promise(resolve => { server.close(resolve); server.closeAllConnections(); }));
    const response = await fetch(`http://127.0.0.1:${server.address().port}/src/runtime-config.js`);
    assert.equal(response.status, 200);
    assert.equal(response.headers.get('Cache-Control'), 'no-store');
    assert.equal(await response.text(), `export const apiBase = ${JSON.stringify(apiBase)};`);
  }
});
