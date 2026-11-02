import assert from 'node:assert/strict';
import { test } from 'node:test';
import { escapeHtml } from './utils';

test('escapeHtml neutralises markup in filenames', () => {
	assert.equal(escapeHtml('<img src=x onerror="a()">.mp4'), '&lt;img src=x onerror=&quot;a()&quot;&gt;.mp4');
	assert.equal(escapeHtml("a&b'c"), 'a&amp;b&#39;c');
	assert.equal(escapeHtml(null), '');
});
