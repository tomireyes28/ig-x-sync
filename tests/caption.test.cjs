const { test } = require('node:test');
const assert = require('node:assert/strict');
const { parseTweet, extractUrlsWithIndices } = require('twitter-text');
const { formatTweetCaption } = require('../dist/utils/caption');

test('normalizes NFC, supplies fallback and retains text exactly at weighted boundary', () => {
  assert.equal(formatTweetCaption('  cafe\u0301  '), 'café');
  assert.equal(formatTweetCaption('  '), 'Nueva actualización');
  assert.equal(formatTweetCaption('a'.repeat(280)), 'a'.repeat(280));
  assert.equal(formatTweetCaption('漢'.repeat(140)), '漢'.repeat(140));
});

test('truncates weighted CJK and complex emoji without splitting graphemes', () => {
  for (const token of ['漢', '👩🏽‍💻', '👨‍👩‍👧‍👦', '🇦🇷']) {
    const output = formatTweetCaption(token.repeat(200));
    assert.equal(parseTweet(output).valid, true);
    assert.ok(parseTweet(output).weightedLength <= 280);
    assert.ok(output.endsWith('...'));
    assert.equal(output.slice(0, -3).split(token).join(''), '');
  }
});

test('URLs count as 23 and are kept whole or omitted at the truncation boundary', () => {
  const url = `https://example.com/${'long-path-'.repeat(40)}`;
  assert.equal(formatTweetCaption(url), url);
  const withUrl = formatTweetCaption(`Intro ${url} ${'x'.repeat(300)}`);
  assert.equal(extractUrlsWithIndices(withUrl)[0].url, url);
  const omittedUrl = formatTweetCaption(`${'x'.repeat(260)} ${url}`);
  assert.equal(omittedUrl, `${'x'.repeat(260)}...`);
});

test('rejects invalid limits and disallowed code points before upload', () => {
  for (const limit of [0, -1, 3, 281, NaN, 4.5]) assert.throws(() => formatTweetCaption('text', limit));
  assert.throws(() => formatTweetCaption('bad\ufffftext'), /caracteres/);
});
