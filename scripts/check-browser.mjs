import { spawn } from 'node:child_process';
import { mkdtemp, readFile, writeFile, rm, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve, sep } from 'node:path';
import assert from 'node:assert/strict';

const output = process.env.YPC_SCREENSHOTS || join(tmpdir(), 'youthfit-design-check');
await mkdir(output, { recursive: true });
const profile = await mkdtemp(join(tmpdir(), 'youthfit-browser-'));
const chrome = spawn(process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe', [
  '--headless', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
  '--remote-debugging-port=0', `--user-data-dir=${profile}`, 'about:blank',
], { windowsHide: true, stdio: 'ignore' });
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
let socket;
try {
  let port;
  for (let i = 0; i < 100; i++) {
    try { port = Number((await readFile(join(profile, 'DevToolsActivePort'), 'utf8')).split('\n')[0]); break; }
    catch { await pause(100); }
  }
  assert.ok(port, 'Chrome debugging endpoint must start');
  const tab = await (await fetch(`http://127.0.0.1:${port}/json/new?about:blank`, { method: 'PUT' })).json();
  socket = new WebSocket(tab.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => { socket.onopen = resolve; socket.onerror = reject; });
  let sequence = 0;
  const pending = new Map();
  const exceptions = [];
  socket.onmessage = ({ data }) => {
    const message = JSON.parse(data);
    if (message.method === 'Runtime.exceptionThrown') exceptions.push(message.params.exceptionDetails.text);
    if (message.id) {
      const waiter = pending.get(message.id);
      pending.delete(message.id);
      if (message.error) waiter.reject(new Error(message.error.message)); else waiter.resolve(message.result);
    }
  };
  const send = (method, params = {}) => new Promise((resolve, reject) => {
    const id = ++sequence;
    pending.set(id, { resolve, reject });
    socket.send(JSON.stringify({ id, method, params }));
  });
  const evaluate = async expression => {
    const result = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
    if (result.exceptionDetails) throw new Error(result.exceptionDetails.text);
    return result.result.value;
  };
  const until = async expression => {
    for (let i = 0; i < 100; i++) {
      try { if (await evaluate(expression)) return; }
      catch (error) {
        if (!/navigated or closed|context was destroyed|Cannot find context/.test(error.message)) throw error;
      }
      await pause(100);
    }
    throw new Error(`Browser condition timed out: ${expression}`);
  };
  const screenshot = async name => {
    const { data } = await send('Page.captureScreenshot', { format: 'png' });
    await writeFile(join(output, `${name}.png`), Buffer.from(data, 'base64'));
  };
  await send('Page.enable');
  await send('Runtime.enable');
  await send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 680, deviceScaleFactor: 1.25, mobile: false });
  await send('Page.navigate', { url: 'http://127.0.0.1:5173/#/results' });
  await until("Boolean(document.querySelector('#editProfile'))");
  await evaluate('document.fonts.ready.then(() => true)');
  await screenshot('dashboard');
  await evaluate("document.querySelector('.layout').scrollIntoView()");
  await screenshot('policies');
  await evaluate("document.querySelector('[data-reference-filter=pass]').click()");
  assert.equal(await evaluate("document.querySelectorAll('.policy:not(.hidden)').length"), 2);
  await evaluate("document.querySelector('[data-reference-filter=all]').click(); window.scrollTo({top:0,behavior:'instant'})");
  await evaluate("document.querySelector('#editProfile').click()");
  assert.equal(await evaluate("document.querySelector('#profileOverlay').classList.contains('open')"), true);
  await screenshot('profile-top');
  await evaluate("document.querySelector('#profileOverlay .modal').scrollTop = 400");
  await screenshot('profile-middle');
  await evaluate("document.querySelector('#profileOverlay .modal').scrollTop = 2000");
  await screenshot('profile-bottom');
  await evaluate("document.querySelector('.optional-question').click()");
  assert.equal(await evaluate("Boolean(document.querySelector('#questionOverlay.open'))"), true);
  await evaluate("document.querySelector('.answer').click()");
  assert.equal(await evaluate("Boolean(document.querySelector('#profileOverlay.open'))"), true);
  await evaluate("document.querySelector('#userName').value = '<b>테스트</b>'; document.querySelector('#profileForm').requestSubmit()");
  assert.equal(await evaluate("document.querySelector('.hero h1').querySelector('b') === null"), true);
  assert.equal(await evaluate("document.querySelector('.hero h1').textContent.startsWith('<b>테스트</b>')"), true);
  await evaluate("sessionStorage.removeItem('ypc.reference-profile.v1'); location.hash = '#/profile'");
  await until("Boolean(document.querySelector('#profileOverlay.open'))");
  await evaluate("document.querySelector('#profileOverlay [data-close]').click()");
  await until("location.hash === '#/results' && !document.querySelector('.overlay.open')");
  await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
  await screenshot('mobile-dashboard');
  assert.equal(await evaluate('document.documentElement.scrollWidth <= innerWidth'), true, 'Mobile dashboard must not overflow');
  await evaluate("document.querySelector('#editProfile').click()");
  await screenshot('mobile-profile');
  assert.equal(await evaluate("document.querySelector('#profileOverlay .modal').scrollWidth <= document.querySelector('#profileOverlay .modal').clientWidth"), true, 'Mobile modal must not overflow');
  await send('Page.navigate', { url: 'http://127.0.0.1:4173/#/profile' });
  await until("Boolean(document.querySelector('#profileOverlay.open'))");
  await send('Page.navigate', { url: 'http://127.0.0.1:5173/profile.html' });
  await until("location.hash === '#/profile' && Boolean(document.querySelector('#profileOverlay.open'))");
  assert.deepEqual(exceptions, [], 'No unhandled browser exceptions');
  console.log(`Browser checks passed. Screenshots: ${output}`);
} finally {
  socket?.close();
  chrome.kill();
  await pause(500);
  assert.ok(resolve(profile).startsWith(resolve(tmpdir()) + sep), 'Only remove the generated temporary browser profile');
  await rm(profile, { recursive: true, force: true, maxRetries: 5, retryDelay: 300 });
}
