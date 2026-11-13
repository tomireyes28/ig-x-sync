const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { createStateStore } = require('../dist/utils/state');
const { runSync } = require('../dist/sync');
const { createInstagramService } = require('../dist/services/instagram');

const media = (id, type = 'IMAGE') => ({ id, media_type: type, media_url: 'https://cdn.example/photo.jpg', caption: id });
const account = { id: '1', label: 'Demo' };
function dependencies(t, posts) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ig-x-sync-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const state = createStateStore(path.join(dir, 'state.json'));
  const published = [];
  return { published, state, fetchFeed: async () => ({ username: 'demo', mediaCount: posts.length, posts }),
    prepare: async post => ({ mediaId: post.id, text: post.caption }),
    publish: async prepared => { published.push(prepared.mediaId); return { id: '99' }; },
    preview: text => text, log: () => {} };
}

test('all pending posts publish oldest first, a second execution is a no-op', async t => {
  const deps = dependencies(t, [media('13'), media('12', 'VIDEO'), media('11')]);
  assert.deepEqual(await runSync([account], deps, false), { failures: 0, published: 2 });
  assert.deepEqual(deps.published, ['11', '13']);
  assert.deepEqual(await runSync([account], deps, false), { failures: 0, published: 0 });
});

test('dry-run leaves state and X untouched; account failure is isolated', async t => {
  const deps = dependencies(t, [media('11')]);
  await runSync([account], deps, true);
  assert.deepEqual(deps.published, []);
  assert.equal(deps.state.getAccount('1'), undefined);
  deps.fetchFeed = async id => { if (id === '1') throw new Error('unavailable');
    return { username: 'demo', mediaCount: 1, posts: [media('21')] }; };
  assert.deepEqual(await runSync([account, { id: '2', label: 'Second' }], deps, false), { failures: 1, published: 1 });
  assert.equal(deps.state.has('2', '21'), true);
});

test('pagination reaches checkpoint using cursor on a trusted URL and bearer header', async () => {
  const calls = [];
  const responses = [{ username: 'demo', media_count: 3 },
    { data: [media('13')], paging: { next: 'https://untrusted.example/?access_token=secret', cursors: { after: 'cursor' } } },
    { data: [media('12'), media('11'), media('10')] }];
  const service = createInstagramService({ accessToken: 'secret', apiVersion: 'v25.0' }, {
    get: async (url, options) => { calls.push({ url, options }); return { data: responses.shift() }; },
  });
  assert.deepEqual((await service.fetchAccountFeed('1', '11')).posts.map(p => p.id), ['13', '12']);
  assert.equal(calls[2].url, 'https://graph.facebook.com/v25.0/1/media');
  assert.equal(calls[2].options.params.after, 'cursor');
  assert.equal(calls[2].options.headers.Authorization, 'Bearer secret');
  assert.equal(calls[2].options.params.access_token, undefined);
});

test('bootstrap only returns the latest eligible post, including beyond a video-only page', async () => {
  const responses = [{ username: 'demo' }, { data: [media('13', 'VIDEO')],
    paging: { next: 'next', cursors: { after: 'cursor' } } }, { data: [media('12'), media('11')] }];
  const service = createInstagramService({ accessToken: 'x', apiVersion: 'v25.0' }, {
    get: async () => ({ data: responses.shift() }),
  });
  assert.deepEqual((await service.fetchAccountFeed('1')).posts.map(p => p.id), ['13', '12']);
});

test('missing checkpoint and repeated or excessive pages stop without advancing state', async () => {
  const settings = { accessToken: 'x', apiVersion: 'v25.0' };
  const missing = createInstagramService(settings, { get: async url => ({ data: url.endsWith('/media') ? { data: [] } : {} }) });
  await assert.rejects(missing.fetchAccountFeed('1', '11'), /último post/);
  const repeated = createInstagramService(settings, { get: async url => ({ data: url.endsWith('/media')
    ? { data: [], paging: { next: 'next', cursors: { after: 'same' } } } : {} }) });
  await assert.rejects(repeated.fetchAccountFeed('1', '11'), /repetida/);
  let cursor = 0;
  const endless = createInstagramService(settings, { get: async url => ({ data: url.endsWith('/media')
    ? { data: [], paging: { next: 'next', cursors: { after: String(++cursor) } } } : {} }) });
  await assert.rejects(endless.fetchAccountFeed('1', '11'), /20 páginas/);
});

test('ambiguous creation persists pending and prevents any further remote attempt', async t => {
  const deps = dependencies(t, [media('11')]);
  let attempts = 0;
  deps.publish = async () => { attempts++; throw new Error('socket closed after send'); };
  assert.equal((await runSync([account], deps, false)).failures, 1);
  assert.equal(deps.state.getAccount('1').pendingPost.postId, '11');
  assert.equal(deps.state.getAccount('1').lastPostId, undefined);
  assert.equal((await runSync([account], deps, false)).failures, 1);
  assert.equal(attempts, 1);
  deps.state.clearPending('1');
  deps.publish = async () => ({ id: '99' });
  assert.equal((await runSync([account], deps, false)).published, 1);
  assert.equal(deps.state.getAccount('1').pendingPost, undefined);
});

test('failed preparation does not mark pending or advance checkpoint', async t => {
  const deps = dependencies(t, [media('11')]);
  deps.prepare = async () => { throw new Error('download unavailable'); };
  assert.equal((await runSync([account], deps, false)).failures, 1);
  assert.equal(deps.state.getAccount('1'), undefined);
  assert.deepEqual(deps.published, []);
});

test('remote pending checkpoint must succeed before any X creation', async t => {
  const deps = dependencies(t, [media('11')]);
  deps.checkpoint = async () => { throw new Error('push rejected'); };
  assert.equal((await runSync([account], deps, false)).failures, 1);
  assert.deepEqual(deps.published, []);
  assert.equal(deps.state.getAccount('1').pendingPost.postId, '11');
});

test('remote checkpoints bracket creation; partial failure leaves next run blocked', async t => {
  const deps = dependencies(t, [media('12'), media('11')]);
  const events = [];
  deps.checkpoint = async () => {
    events.push(deps.state.getAccount('1').pendingPost ? 'pending' : 'confirmed');
  };
  deps.publish = async prepared => {
    events.push(`create:${prepared.mediaId}`);
    if (prepared.mediaId === '12') throw new Error('unknown');
    return { id: '99' };
  };
  assert.deepEqual(await runSync([account], deps, false), { failures: 1, published: 1 });
  assert.deepEqual(events, ['pending', 'create:11', 'confirmed', 'pending', 'create:12']);
  assert.equal(deps.state.has('1', '11'), true);
  assert.equal(deps.state.getAccount('1').pendingPost.postId, '12');
});
