import test from 'node:test';
import assert from 'node:assert/strict';
import { contactNotice } from '../src/confidence.js';

test('a CONFIRMED result needs no contact notice at all', () => {
  assert.equal(contactNotice({ confidence: 'CONFIRMED', dept_name: null, dept_tel: null, origin_url: null }), '');
});

test('shows department and phone together when BE has both on file', () => {
  const notice = contactNotice({ confidence: 'ESTIMATED', dept_name: '청년정책과', dept_tel: '031-000-0000', origin_url: 'https://example.org/a' });
  assert.match(notice, /청년정책과 · 031-000-0000로 최종 확인해 주세요\./);
  assert.match(notice, /href="https:\/\/example\.org\/a"/);
});

test('falls back to the source link when neither department nor phone is on file, without printing an empty "로"', () => {
  const notice = contactNotice({ confidence: 'NEEDS_REVIEW', dept_name: null, dept_tel: null, origin_url: 'https://example.org/b' });
  assert.doesNotMatch(notice, /^\s*로/);
  assert.match(notice, /아래 공고 원문에서 최종 확인해 주세요\./);
  assert.match(notice, /href="https:\/\/example\.org\/b"/);
});

test('shows whichever single contact field is present', () => {
  assert.match(contactNotice({ confidence: 'ESTIMATED', dept_name: '청년정책과', dept_tel: null, origin_url: null }), /^청년정책과로 최종 확인해 주세요\./);
  assert.match(contactNotice({ confidence: 'ESTIMATED', dept_name: null, dept_tel: '031-000-0000', origin_url: null }), /^031-000-0000로 최종 확인해 주세요\./);
});

test('escapes hostile department/contact text and never treats a javascript: link as a real origin_url source', () => {
  const notice = contactNotice({ confidence: 'ESTIMATED', dept_name: '<script>alert(1)</script>', dept_tel: null, origin_url: 'https://example.org/c' });
  assert.doesNotMatch(notice, /<script>/);
  assert.match(notice, /&lt;script&gt;/);
});
