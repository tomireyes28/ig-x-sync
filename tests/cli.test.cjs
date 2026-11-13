const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { spawnSync } = require('node:child_process');

function fixture(t) {
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'ig-x-cli-'));
  t.after(() => fs.rmSync(cwd, { recursive: true, force: true }));
  return cwd;
}
function run(script, args, cwd) {
  // Explicit environment prevents loading either this project's .env or Actions credentials.
  const env = Object.fromEntries(Object.entries(process.env).filter(([key]) =>
    ['path', 'systemroot', 'temp', 'tmp', 'home', 'userprofile'].includes(key.toLowerCase())));
  return spawnSync(process.execPath, [path.resolve(__dirname, '../dist', script), ...args],
    { cwd, env, encoding: 'utf8', timeout: 15000, windowsHide: true });
}

test('compiled CLI fails clearly for an invalid flag without contacting APIs or leaving a lock', t => {
  const cwd = fixture(t);
  const result = run('index.js', ['--dryrun'], cwd);
  assert.equal(result.status, 1);
  assert.match(result.stderr, /Argumento desconocido/);
  assert.equal(fs.existsSync(path.join(cwd, 'data/sync-state.json.lock')), false);
});

test('compiled checkpoint command refuses a missing remote branch', t => {
  const result = run('checkpoint.js', [], fixture(t));
  assert.equal(result.status, 1);
  assert.match(result.stderr, /Rama inválida/);
});

test('compiled recovery confirms an uncertain tweet and retains history', t => {
  const cwd = fixture(t);
  const file = path.join(cwd, 'data/sync-state.json');
  fs.mkdirSync(path.dirname(file));
  fs.writeFileSync(file, JSON.stringify({ '1': { lastPostId: '10', lastSyncedAt: '2026-11-13T00:00:00Z',
    pendingPost: { postId: '11', startedAt: '2026-11-13T01:00:00Z' } } }));
  const result = run('recover.js', ['--account', '1', '--tweet', '99'], cwd);
  assert.equal(result.status, 0, result.stderr);
  const state = JSON.parse(fs.readFileSync(file));
  assert.equal(state['1'].lastPostId, '11');
  assert.equal(state['1'].lastTweetId, '99');
  assert.deepEqual(state['1'].syncedPostIds, ['10', '11']);
  assert.equal(state['1'].pendingPost, undefined);
});

test('compiled recovery clears a verified non-publication; invalid commands leave state intact', t => {
  const cwd = fixture(t);
  const file = path.join(cwd, 'data/sync-state.json');
  fs.mkdirSync(path.dirname(file));
  const original = JSON.stringify({ '1': { pendingPost: { postId: '11', startedAt: '2026-11-13T01:00:00Z' } } });
  fs.writeFileSync(file, original);
  assert.equal(run('recover.js', ['--account', '1', '--tweet', 'bad'], cwd).status, 1);
  assert.equal(fs.readFileSync(file, 'utf8'), original);
  const result = run('recover.js', ['--account', '1', '--not-published'], cwd);
  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(JSON.parse(fs.readFileSync(file)), {});
});
