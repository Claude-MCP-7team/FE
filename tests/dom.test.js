import test from 'node:test';
import assert from 'node:assert/strict';
import { escape } from '../src/dom.js';

test('escape encodes markup and both attribute quote delimiters', () => {
  assert.equal(escape(`<img src=x onerror="alert('x')"> &`), '&lt;img src=x onerror=&quot;alert(&#39;x&#39;)&quot;&gt; &amp;');
});
test('escape preserves Korean text and zero while tolerating absent values', () => {
  assert.equal(escape('청년 정책'), '청년 정책');
  assert.equal(escape(0), '0');
  assert.equal(escape(null), '');
  assert.equal(escape(undefined), '');
});
