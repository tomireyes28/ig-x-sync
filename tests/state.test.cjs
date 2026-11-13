const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { createStateStore, loadSyncState } = require('../dist/utils/state');

function fixture(t) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ig-x-state-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  return path.join(dir, 'state.json');
}
const record = (id) => ({ lastPostId: id, lastTweetId: '99', lastSyncedAt: '2026-11-13T00:00:00Z' });

test('missing state bootstraps, corrupt or invalid state fails closed', (t) => {
  const file = fixture(t);
  assert.deepEqual(loadSyncState(file), {});
  for (const content of ['{', 'null', '[]', '{"1":{}}', '{"1":{"lastPostId":3}}']) {
    fs.writeFileSync(file, content);
    assert.throws(() => createStateStore(file));
    assert.equal(fs.readFileSync(file, 'utf8'), content);
  }
});

test('legacy state is readable and history survives multiple writes and restart', (t) => {
  const file = fixture(t);
  fs.writeFileSync(file, JSON.stringify({ '1': record('10') }));
  const store = createStateStore(file);
  store.mark('1', record('11'));
  store.mark('2', record('20'));
  const restarted = createStateStore(file);
  assert.equal(restarted.has('1', '10'), true);
  assert.equal(restarted.has('1', '11'), true);
  assert.equal(restarted.has('2', '20'), true);
  assert.deepEqual(fs.readdirSync(path.dirname(file)), ['state.json']);
  const copy = restarted.getAccount('1');
  copy.syncedPostIds.push('999');
  assert.equal(restarted.has('1', '999'), false);
});
