const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createRemoteCheckpoint } = require('../dist/utils/checkpoint');

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
