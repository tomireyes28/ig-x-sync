const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createRemoteCheckpoint } = require('../dist/utils/checkpoint');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { spawnSync } = require('node:child_process');

test('checkpoint commits only the state file then pushes an explicit ref without force', async () => {
  const calls = [];
  const git = args => { calls.push(args); return args[0] === 'diff' ? 1 : 0; };
  await createRemoteCheckpoint('main', git)();
  assert.equal(calls[3].includes('--only'), true);
  assert.deepEqual(calls.at(-1), ['push', 'origin', 'HEAD:refs/heads/main']);
  assert.equal(calls.flat().includes('--force'), false);
});

test('unchanged state still pushes previously committed work; errors are redacted', async () => {
  const calls = [];
  await createRemoteCheckpoint('main', args => { calls.push(args); return 0; })();
  assert.equal(calls.flat().includes('commit'), false);
  assert.equal(calls.at(-1)[0], 'push');
  const failed = createRemoteCheckpoint('main', args => args[0] === 'push' ? 128 : 0);
  await assert.rejects(failed(), /estado en GitHub/);
  assert.throws(() => createRemoteCheckpoint('--unsafe', () => 0), /Rama inválida/);
});

test('real Git checkpoint preserves unrelated staged work and fails on a remote conflict', async t => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'ig-x-git-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const work = path.join(root, 'work');
  const remote = path.join(root, 'remote.git');
  fs.mkdirSync(work);
  const git = (args, cwd = work) => spawnSync('git', ['-c', 'commit.gpgsign=false',
    '-c', `core.hooksPath=${path.join(root, 'no-hooks')}`, ...args],
    { cwd, encoding: 'utf8', timeout: 15000, windowsHide: true });
  const must = (args, cwd) => {
    const result = git(args, cwd);
    assert.equal(result.status, 0, result.stderr);
    return result.stdout.trim();
  };
  must(['init', '--bare', '--initial-branch=main', remote]);
  must(['init', '--initial-branch=main']);
  must(['config', 'user.name', 'Test']);
  must(['config', 'user.email', 'test@example.invalid']);
  fs.mkdirSync(path.join(work, 'data'));
  const file = path.join(work, 'data/sync-state.json');
  fs.writeFileSync(file, '{}\n');
  must(['add', '.']);
  must(['commit', '-m', 'fixture']);
  must(['remote', 'add', 'origin', remote]);
  let lastError = '';
  const checkpoint = createRemoteCheckpoint('main', args => {
    const result = git(args); lastError = result.stderr; return result.status;
  });
  await checkpoint().catch(() => assert.fail(lastError));
  const pending = JSON.stringify({ '1': { pendingPost: { postId: '11', startedAt: '2026-11-13T00:00:00Z' } } });
  fs.writeFileSync(file, pending);
  fs.writeFileSync(path.join(work, 'unrelated.txt'), 'leave staged');
  must(['add', 'unrelated.txt']);
  await checkpoint();
  assert.equal(must(['diff', '--cached', '--name-only']), 'unrelated.txt');
  assert.equal(must(['show', 'main:data/sync-state.json'], remote), pending);
  const other = path.join(root, 'other');
  must(['clone', remote, other]);
  must(['config', 'user.name', 'Other'], other);
  must(['config', 'user.email', 'other@example.invalid'], other);
  fs.writeFileSync(path.join(other, 'change.txt'), 'concurrent change');
  must(['add', '.'], other);
  must(['commit', '-m', 'concurrent change'], other);
  must(['push', 'origin', 'main'], other);
  fs.writeFileSync(file, '{}\n');
  await assert.rejects(checkpoint(), /estado en GitHub/);
  assert.equal(must(['show', 'main:data/sync-state.json'], remote), pending);
});
