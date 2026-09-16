import test from 'node:test';
import assert from 'node:assert/strict';
import { createPageLoader } from '../src/page-loader.js';

function pending() {
  let resolve, reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}
function setup(page = 'profile') {
  const frames = [];
  const requests = [];
  const state = { page };
  const loader = createPageLoader({
    needsData: () => state.page !== 'profile',
    renderPage: data => frames.push({ page: state.page, data }),
    renderLoading: () => frames.push({ page: 'loading' }),
    renderError: () => frames.push({ page: 'error' }),
    loadData: () => { const request = pending(); requests.push(request); return request.promise; },
  });
  return { loader, state, frames, requests };
}
test('direct profile entry renders before policy request and survives failure without remount', async () => {
  const { loader, frames, requests } = setup();
  loader.show();
  const task = loader.load();
  assert.deepEqual(frames, [{ page: 'profile', data: undefined }]);
  requests[0].reject(new Error('offline'));
  await task;
  assert.equal(frames.length, 1, 'failed fetch must not replace the active form');
});
test('navigation from policy error to profile works, and returning preserves policy retry', async () => {
  const { loader, state, frames, requests } = setup('results');
  const first = loader.load();
  requests[0].reject(new Error('invalid fixture'));
  await first;
  assert.equal(frames.at(-1).page, 'error');
  state.page = 'profile'; loader.show();
  assert.equal(frames.at(-1).page, 'profile');
  state.page = 'results'; loader.show();
  assert.equal(frames.at(-1).page, 'error');
  const retry = loader.load();
  assert.equal(frames.at(-1).page, 'loading');
  const fixture = { results: [] };
  requests[1].resolve(fixture);
  await retry;
  assert.deepEqual(frames.at(-1), { page: 'results', data: fixture });
});
test('late success or failure cannot reset a form opened while results were loading', async () => {
  for (const outcome of ['resolve', 'reject']) {
    const { loader, state, frames, requests } = setup('results');
    const task = loader.load();
    state.page = 'profile'; loader.show();
    const mountedFrames = frames.length;
    requests[0][outcome](outcome === 'resolve' ? { results: [] } : new Error('offline'));
    await task;
    assert.equal(frames.length, mountedFrames);
    assert.equal(frames.at(-1).page, 'profile');
    state.page = 'results'; loader.show();
    assert.equal(frames.at(-1).page, outcome === 'resolve' ? 'results' : 'error');
  }
});
test('latest request wins when retries complete out of order', async () => {
  for (const outcome of ['resolve', 'reject']) {
    const { loader, frames, requests } = setup('results');
    const older = loader.load(); const newer = loader.load();
    requests[1].resolve({ version: 2 }); await newer;
    const count = frames.length;
    requests[0][outcome]({ version: 1 }); await older;
    assert.equal(frames.length, count);
    assert.deepEqual(frames.at(-1), { page: 'results', data: { version: 2 } });
  }
});
test('policy route entered during a profile background request receives its result', async () => {
  const { loader, state, frames, requests } = setup();
  loader.show(); const task = loader.load();
  state.page = 'results'; loader.show();
  assert.equal(frames.at(-1).page, 'loading');
  requests[0].resolve({ results: [] }); await task;
  assert.equal(frames.at(-1).page, 'results');
});
