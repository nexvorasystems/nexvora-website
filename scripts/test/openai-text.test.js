'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { generateText } = require('../lib/openai-text');
const { validateArticle, parseMeta } = require('../generate-post');

const completed = text => ({
  status: 'completed', model: 'gpt-6-luna',
  output: [{ type: 'reasoning' }, { type: 'message', content: [{ type: 'output_text', text }] }],
  usage: { input_tokens: 20, output_tokens: 10 },
});
function mockFetch(responses, calls) {
  return async (url, options) => {
    calls.push({ url, options, body: JSON.parse(options.body) });
    const [status, data] = responses.shift();
    return { ok: status === 200, status, json: async () => data };
  };
}
const options = (responses, calls) => ({
  apiKey: 'test-secret', fetchImpl: mockFetch(responses, calls),
  sleep: async () => {}, logger: () => {},
});

test('Responses output is read after reasoning items, with bounded non-reasoning generation', async () => {
  const calls = [];
  const text = await generateText('article prompt', options([[200, completed('Complete article')]], calls));
  assert.equal(text, 'Complete article');
  assert.equal(calls[0].url, 'https://api.openai.com/v1/responses');
  assert.equal(calls[0].body.model, 'gpt-6-luna');
  assert.equal(calls[0].body.reasoning.effort, 'none');
  assert.equal(calls[0].body.store, false);
  assert.equal(calls[0].body.max_output_tokens, 8000);
  assert.equal(calls[0].body.temperature, undefined);
});

test('truncated and refused output cannot be published', async () => {
  for (const result of [
    { ...completed('Partial article'), status: 'incomplete', incomplete_details: { reason: 'max_output_tokens' } },
    { status: 'completed', output: [{ type: 'message', content: [{ type: 'refusal', refusal: 'No' }] }] },
    { status: 'completed', output: [] },
  ]) {
    await assert.rejects(generateText('prompt', options([[200, result]], [])), /rejected/);
  }
});

test('authentication errors stop immediately and redact the credential', async () => {
  const calls = [];
  await assert.rejects(
    generateText('prompt', options([[401, { error: { code: 'invalid_api_key', message: 'Invalid test-secret' } }]], calls)),
    error => error.status === 401 && error.message.includes('[REDACTED]') && !error.message.includes('test-secret')
  );
  assert.equal(calls.length, 1);
});

test('billing and enforced spend errors are never retried', async () => {
  const calls = [];
  await assert.rejects(generateText('prompt', options([
    [429, { error: { code: 'insufficient_quota', message: 'Organization reached its enforced spend limit' } }],
  ], calls)), /insufficient_quota/);
  assert.equal(calls.length, 1);
});

test('temporary rate limits retry then recover', async () => {
  const calls = [];
  const text = await generateText('prompt', options([
    [429, { error: { code: 'rate_limit_exceeded', message: 'Rate limit exceeded' } }],
    [503, { error: { message: 'Service unavailable' } }],
    [200, completed('Recovered article')],
  ], calls));
  assert.equal(text, 'Recovered article');
  assert.equal(calls.length, 3);
});

test('persistent server failures stop after three attempts', async () => {
  const calls = [];
  await assert.rejects(generateText('prompt', options(
    Array.from({ length: 3 }, () => [503, { error: { message: 'Unavailable' } }]), calls
  )), /503/);
  assert.equal(calls.length, 3);
});

const article = `Title: Marketing for Local Businesses
Meta Title: Local Business Marketing
Meta Description: A practical guide to improving local business marketing.
Slug: local-business-marketing
Primary Keyword: local business marketing
Article Type: Pillar
## Introduction
${'Useful business guidance. '.repeat(1100)}
## Frequently Asked Questions
**Q:** How do I start?
**A:** Review your current process first.
[Start Your Free Business Assessment](https://nexvorasystems.us/assessment.html)
`;

test('article checks accept complete output and reject short or unsafe content', () => {
  assert.ok(validateArticle(article, 'pillar', 3200).wordCount >= 3200);
  assert.throws(() => validateArticle(article.replace('Useful business guidance. '.repeat(1100), 'Too short.'), 'pillar', 3200), /too short/);
  assert.throws(() => validateArticle(article.replace('Slug: local-business-marketing', 'Slug: ../index'), 'pillar', 3200), /slug/);
  assert.throws(() => validateArticle(article.replace('Article Type: Pillar', 'Article Type: Support'), 'pillar', 3200), /type/);
  assert.throws(() => validateArticle(article.replace('**Q:**', 'Question:'), 'pillar', 3200), /FAQ/);
});

test('metadata parser cannot confuse Meta Title with Title', () => {
  assert.equal(parseMeta('Meta Title: Metadata first\nTitle: Actual title\nSlug: actual-title').title, 'Actual title');
});

test('preview runs both article passes without publishing integrations', async () => {
  const fs = require('node:fs');
  const os = require('node:os');
  const path = require('node:path');
  const previewDir = fs.mkdtempSync(path.join(os.tmpdir(), 'nexvora-preview-test-'));
  const originalFetch = globalThis.fetch;
  const oldKey = process.env.OPENAI_API_KEY;
  const oldDryRun = process.env.BLOG_DRY_RUN;
  const calls = [];
  const support = article.replace('Article Type: Pillar', 'Article Type: Support') +
    '\n[Full guide](https://nexvorasystems.us/posts/local-business-marketing.html)';
  try {
    process.env.OPENAI_API_KEY = 'test-secret';
    process.env.BLOG_DRY_RUN = 'true';
    globalThis.fetch = mockFetch(
      [article, article, support, support].map(text => [200, completed(text)]), calls
    );
    await require('../generate-post').main({ previewDir });
    assert.equal(calls.length, 4);
    assert.ok(calls.every(call => call.url === 'https://api.openai.com/v1/responses'));
    assert.deepEqual(fs.readdirSync(previewDir).sort(), ['pillar.md', 'support.md']);
  } finally {
    globalThis.fetch = originalFetch;
    if (oldKey === undefined) delete process.env.OPENAI_API_KEY;
    else process.env.OPENAI_API_KEY = oldKey;
    if (oldDryRun === undefined) delete process.env.BLOG_DRY_RUN;
    else process.env.BLOG_DRY_RUN = oldDryRun;
    fs.rmSync(previewDir, { recursive: true, force: true });
  }
});


test('article generation retries truncated output once, then runs its review', async () => {
  const oldFetch = globalThis.fetch;
  const oldKey = process.env.OPENAI_API_KEY;
  const calls = [];
  try {
    process.env.OPENAI_API_KEY = 'test-secret';
    globalThis.fetch = mockFetch([
      [200, { status: 'incomplete', incomplete_details: { reason: 'max_output_tokens' } }],
      [200, completed(article)],
      [200, completed(article)],
    ], calls);
    const result = await require('../generate-post').writeArticle('Write a pillar.', 'pillar', 3200, 12000, 12000);
    assert.equal(result, article.trim());
    assert.equal(calls.length, 3);
    assert.match(calls[1].body.input, /previous response exceeded the output limit/);
  } finally {
    globalThis.fetch = oldFetch;
    if (oldKey === undefined) delete process.env.OPENAI_API_KEY;
    else process.env.OPENAI_API_KEY = oldKey;
  }
});

test('article generation stops after a repeated truncation', async () => {
  const oldFetch = globalThis.fetch;
  const oldKey = process.env.OPENAI_API_KEY;
  const calls = [];
  try {
    process.env.OPENAI_API_KEY = 'test-secret';
    globalThis.fetch = mockFetch(Array.from({ length: 2 }, () =>
      [200, { status: 'incomplete', incomplete_details: { reason: 'max_output_tokens' } }]), calls);
    await assert.rejects(require('../generate-post').writeArticle('Write a pillar.', 'pillar', 3200, 12000, 12000), /article rejected/);
    assert.equal(calls.length, 2);
  } finally {
    globalThis.fetch = oldFetch;
    if (oldKey === undefined) delete process.env.OPENAI_API_KEY;
    else process.env.OPENAI_API_KEY = oldKey;
  }
});
