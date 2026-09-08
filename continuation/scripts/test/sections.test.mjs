import { test } from 'node:test';
import assert from 'node:assert/strict';
import { section } from '../lib/sections.mjs';

test('exact heading wins', () => {
  assert.equal(section('## Next task\nDo a\n\n## Key files\n- x\n', 'Next task'), 'Do a');
});

test('loose heading variants match', () => {
  assert.equal(section('## Suggested next task\nDo b\n\n## Also outstanding\nz\n', 'Next task'), 'Do b');
  assert.equal(section('## Specific next task\nDo c\n', 'Next task'), 'Do c');
  assert.equal(section('## Key files to read first\n- a\n- b\n## Notes\nn\n', 'Key files'), '- a\n- b');
});

test('unknown heading returns empty', () => {
  assert.equal(section('## Something\nx\n', 'Next task'), '');
  assert.equal(section('## Something\nx\n', 'Consequences'), '');
});
