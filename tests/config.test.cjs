const { test } = require('node:test');
const assert = require('node:assert/strict');
const { loadConfig } = require('../dist/config');
const base = { META_ACCESS_TOKEN: ' meta ', IG_ACCOUNT_IDS: '1, 2,1' };
const credentials = { TWITTER_API_KEY: 'key', TWITTER_API_SECRET: 'secret',
  TWITTER_ACCESS_TOKEN: 'token', TWITTER_ACCESS_SECRET: 'secret' };

test('dry-run requires only Meta and accounts, trims and deduplicates all aliases', () => {
  const config = loadConfig({ ...base, IG_MN_AGENT_ID: '1', IG_MN_FEDERAL_ID: '1' }, ['--dry-run']);
  assert.equal(config.twitter, undefined);
  assert.equal(config.meta.accessToken, 'meta');
  assert.deepEqual(config.meta.accounts.map(a => a.id), ['1', '2']);
  assert.equal(loadConfig({ ...base, DRY_RUN: 'true' }, []).dryRun, true);
});

test('live mode requires each X credential and invalid flags cannot silently publish', () => {
  for (const key of Object.keys(credentials)) {
    const env = { ...base, ...credentials, [key]: ' ' };
    assert.throws(() => loadConfig(env, []), new RegExp(key));
  }
  assert.equal(loadConfig({ ...base, ...credentials }, []).dryRun, false);
  for (const args of [['--dryrun'], ['--dry-run=false'], ['--publish']]) assert.throws(() => loadConfig(base, args));
});

test('rejects malformed IDs, API versions, booleans, empty accounts and missing Meta', () => {
  for (const env of [{ ...base, IG_ACCOUNT_IDS: '../me' }, { ...base, IG_ACCOUNT_IDS: ' , ' },
    { ...base, META_GRAPH_API_VERSION: 'v25.0/me' }, { ...base, DRY_RUN: 'yes' },
    { ...base, META_ACCESS_TOKEN: '' }]) assert.throws(() => loadConfig(env, ['--dry-run']));
});
