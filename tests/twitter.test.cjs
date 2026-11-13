const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createTwitterService } = require('../dist/services/twitter');
const { xRequestTimeout } = require('../dist/services/twitter');
const { TwitterApi } = require('twitter-api-v2');

test('preparation uploads binary once, creation uses the returned media ID and normalized text', async () => {
  const buffer = Buffer.from([0xff, 0xd8, 0xff]);
  let uploads = 0;
  let creations = 0;
  const client = {
    v1: { uploadMedia: async (bytes, options) => {
      uploads++; assert.equal(bytes, buffer); assert.equal(options.mimeType, 'image/jpeg'); return '88';
    } },
    v2: { tweet: async payload => {
      creations++; assert.deepEqual(payload, { text: 'Hello', media: { media_ids: ['88'] } });
      return { data: { id: '99' } };
    } },
  };
  const service = createTwitterService({}, client, async () => ({ buffer, mimeType: 'image/jpeg' }));
  const prepared = await service.prepareTweet('https://example.test', '  Hello  ');
  assert.equal(uploads, 1);
  assert.equal(creations, 0);
  assert.deepEqual(await service.publishTweet(prepared), { id: '99' });
  assert.equal(creations, 1);
});

test('failed creation is never automatically retried and malformed results fail', async () => {
  let attempts = 0;
  const service = createTwitterService({}, { v1: {}, v2: { tweet: async () => {
    attempts++; throw new Error('unknown remote outcome');
  } } });
  await assert.rejects(service.publishTweet({ text: 'test', mediaId: '88' }));
  assert.equal(attempts, 1);
  const malformed = createTwitterService({}, { v1: {}, v2: { tweet: async () => ({ data: {} }) } });
  await assert.rejects(malformed.publishTweet({ text: 'test', mediaId: '88' }), /inválido/);
});

test('real SDK applies a bounded timeout to upload and create before contacting X', async () => {
  const stop = new Error('intercept before network');
  let calls = 0;
  const client = new TwitterApi({ appKey: 'test', appSecret: 'test', accessToken: 'test', accessSecret: 'test' }, {
    plugins: [xRequestTimeout, { onBeforeRequest: ({ requestOptions }) => {
      calls++; assert.equal(requestOptions.timeout, 15000); throw stop;
    } }],
  });
  await assert.rejects(client.v1.uploadMedia(Buffer.from([0xff, 0xd8, 0xff]), { mimeType: 'image/jpeg' }), error => error === stop);
  await assert.rejects(client.v2.tweet({ text: 'test' }), error => error === stop);
  assert.equal(calls, 2);
});
