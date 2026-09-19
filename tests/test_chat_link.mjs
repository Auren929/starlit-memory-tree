import assert from 'node:assert/strict';
import test from 'node:test';
import { memoryTreeUrl } from '../chat_link.js';

globalThis.window = { location: { href: 'http://127.0.0.1:8765/chat' } };

test('chat link preserves a stable ID with Unicode and a slash', () => {
  const url = new URL(memoryTreeUrl('/starmap', '记忆/7'));
  assert.equal(url.pathname, '/starmap');
  assert.equal(url.searchParams.get('star'), '记忆/7');
});

test('chat link rejects unsafe destinations and missing IDs', () => {
  assert.throws(() => memoryTreeUrl('javascript:alert(1)', 'id'));
  assert.throws(() => memoryTreeUrl('/starmap', ''));
});
