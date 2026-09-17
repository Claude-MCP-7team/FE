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
    const allowed = [...(prototype ? ['/', '/index.html'] : ['/', '/index.html', '/src/app.js', '/src/contracts.js', '/src/styles.css', '/src/page-loader.js', '/mocks/scenario.json']), '/profile.html', '/src/profile.js', '/src/profile-form.js', '/src/profile-page.js', '/src/profile.css', '/src/dom.js', '/src/profile-api.js', '/src/profile-repository.js', '/src/runtime-config.js'];
    for (const path of allowed) {
      const response = await fetch(base + path);
      assert.equal(response.status, 200, path);
      assert.ok((await response.text()).length > 0);
    }
    for (const path of ['/package.json', '/tests/contracts.test.js', '/.env.json', '/scripts/serve.mjs', '/prototype/index.html', '/%2e%2e/package.json', '/src/%2e%2e/package.json', '/src%5c..%5cpackage.json', '/%ZZ', ...(prototype ? ['/mocks/scenario.json', '/src/app.js'] : [])]) {
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
