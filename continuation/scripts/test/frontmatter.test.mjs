import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parse, serialize } from '../lib/frontmatter.mjs';

const doc = `---
id: 2026-09-08T083012-stripe-webhook-verification
type: decision
status: active
tags: [stripe, webhooks, security]
summary: Verify Stripe signatures with the SDK, never hand-roll HMAC
branch: feat/stripe
files: [app/Http/Controllers/StripeWebhookController.php]
supersedes: —
superseded_by: —
confidence: high
auto: false
---

## Context
x
`;

test('parse returns data and body', () => {
  const r = parse(doc);
  assert.equal(r.data.id, '2026-09-08T083012-stripe-webhook-verification');
  assert.deepEqual(r.data.tags, ['stripe', 'webhooks', 'security']);
  assert.deepEqual(r.data.files, ['app/Http/Controllers/StripeWebhookController.php']);
  assert.equal(r.data.auto, false);
  assert.equal(r.data.supersedes, '—');
  assert.equal(r.body, '## Context\nx\n');
});

test('parse returns null without a block', () => {
  assert.equal(parse('# Just markdown\n'), null);
});

test('parse handles empty arrays and colons in values', () => {
  const r = parse('---\ntags: []\nsummary: a: b\n---\nbody');
  assert.deepEqual(r.data.tags, []);
  assert.equal(r.data.summary, 'a: b');
});

test('serialize round-trips', () => {
  const r = parse(doc);
  assert.equal(serialize(r.data, r.body), doc);
});
