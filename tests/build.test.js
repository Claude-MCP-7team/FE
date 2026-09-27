import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve, sep } from 'node:path';
import { build } from '../scripts/build.mjs';

async function output(t) {
  const path = await mkdtemp(join(tmpdir(), 'youthfit-build-'));
  t.after(async () => { assert.ok(resolve(path).startsWith(resolve(tmpdir()) + sep)); await rm(path, { recursive: true, force: true }); });
  return path;
}
test('deployment requires an explicit HTTPS backend and never silently falls back to demo', async t => {
  const outputDir = await output(t);
  for (const apiBase of [undefined, '', 'http://example.org', 'https://user:secret@example.org', 'https://example.org/?key=secret']) {
    await assert.rejects(build({ apiBase, outputDir }));
  }
  const result = await build({ apiBase: 'https://be.example.org/', outputDir });
  assert.equal(result.apiBase, 'https://be.example.org');
  assert.match(await readFile(join(outputDir, 'src/runtime-config.js'), 'utf8'), /export const apiBase = "https:\/\/be.example.org"/);
  assert.deepEqual((await readdir(outputDir)).sort(), ['.nojekyll', 'build-info.json', 'index.html', 'mocks', 'profile.html', 'src']);
});
test('static entrypoints and module imports resolve below a project subpath', async t => {
  const outputDir = await output(t);
  await build({ apiBase: 'https://be.example.org', outputDir });
  const origin = 'https://example.org/FE/';
  for (const entry of ['index.html', 'profile.html']) {
    const html = await readFile(join(outputDir, entry), 'utf8');
    for (const [, path] of html.matchAll(/(?:src|href)="([^"#][^"]*)"/g)) {
      if (!path.includes('/src/')) continue;
      const url = new URL(path, origin + entry);
      assert.ok(url.pathname.startsWith('/FE/src/'), url.href);
      await readFile(join(outputDir, url.pathname.slice('/FE/'.length)));
    }
  }
  assert.match(await readFile(join(outputDir, 'src/app.js'), 'utf8'), /new URL\('\.\.\/mocks\/scenario.json', import.meta.url\)/);
  assert.match(await readFile(join(outputDir, 'src/profile-page.js'), 'utf8'), /new URL\('\.\/#\/profile', location.href\)/);
});
test('design preview is opt-in and records its mode in the artifact', async t => {
  const outputDir = await output(t);
  await build({ demo: true, outputDir });
  assert.match(await readFile(join(outputDir, 'src/runtime-config.js'), 'utf8'), /apiBase = null/);
  assert.deepEqual(JSON.parse(await readFile(join(outputDir, 'build-info.json'), 'utf8')), { mode: 'demo', apiBase: null });
});
