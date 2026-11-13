const { test } = require('node:test');
const assert = require('node:assert/strict');
const { downloadImageAsBuffer, MAX_IMAGE_BYTES } = require('../dist/utils/image');
const { resolveSyncablePost } = require('../dist/services/instagram');
const url = 'https://scontent.cdninstagram.com/photo.jpg?signature=example';
const jpeg = Buffer.from([0xff, 0xd8, 0xff, 0, 1]);
const response = (data, mime) => ({ get: async () => ({ data, headers: { 'content-type': mime } }) });

test('download sets timeout, redirect and memory limits; MIME matches binary signature', async () => {
  const http = { get: async (input, options) => {
    assert.equal(input, url);
    assert.equal(options.maxRedirects, 0);
    assert.equal(options.maxContentLength, MAX_IMAGE_BYTES);
    assert.equal(options.timeout, 15000);
    return { data: jpeg, headers: { 'content-type': 'image/jpeg; charset=binary' } };
  } };
  assert.deepEqual(await downloadImageAsBuffer(url, http), { buffer: jpeg, mimeType: 'image/jpeg' });
  const png = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  assert.equal((await downloadImageAsBuffer(url, response(png, 'image/png'))).mimeType, 'image/png');
  const webp = Buffer.from('RIFF0000WEBP');
  assert.equal((await downloadImageAsBuffer(url, response(webp, 'image/webp'))).mimeType, 'image/webp');
});

test('rejects unsafe URLs before network access', async () => {
  const http = { get: async () => { assert.fail('must not contact untrusted hosts'); } };
  for (const input of ['http://scontent.cdninstagram.com/a', 'https://localhost/a',
    'https://127.0.0.1/a', 'https://cdninstagram.com.evil.example/a',
    'https://user:pass@scontent.cdninstagram.com/a', 'https://scontent.cdninstagram.com:8443/a', 'invalid']) {
    await assert.rejects(downloadImageAsBuffer(input, http));
  }
});

test('rejects oversized, empty, unknown and mislabeled content', async () => {
  for (const [data, mime] of [[Buffer.alloc(0), 'image/jpeg'], [Buffer.alloc(MAX_IMAGE_BYTES + 1), 'image/jpeg'],
    [Buffer.from('<html>error</html>'), 'image/jpeg'], [jpeg, 'text/html'], [jpeg, undefined], [jpeg, 'image/png']]) {
    await assert.rejects(downloadImageAsBuffer(url, response(data, mime)));
  }
});

test('mixed carousel selects first image and video-only carousel never uses parent URL', () => {
  const album = { id: '1', media_type: 'CAROUSEL_ALBUM', media_url: 'https://example/video.mp4',
    children: { data: [{ id: '2', media_type: 'VIDEO', media_url: 'video' },
      { id: '3', media_type: 'IMAGE', media_url: url }] } };
  assert.equal(resolveSyncablePost(album).imageUrl, url);
  album.children.data.pop();
  assert.equal(resolveSyncablePost(album), null);
  assert.equal(resolveSyncablePost({ id: '4', media_type: 'VIDEO', media_url: url }), null);
});
