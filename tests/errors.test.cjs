const { test } = require('node:test');
const assert = require('node:assert/strict');
const { AxiosError } = require('axios');
const { ApiResponseError } = require('twitter-api-v2');
const { SafeError, describeError } = require('../dist/utils/errors');

test('HTTP diagnostics keep status and numeric Meta code while dropping request, token and body messages', () => {
  const secret = 'NEVER_PRINT_THIS';
  const error = new AxiosError(secret, 'ECONNRESET', { headers: { Authorization: secret } }, {}, {
    status: 401, data: { error: { code: 190, message: secret } }, headers: {}, config: {},
  });
  const message = describeError(error);
  assert.match(message, /401/);
  assert.match(message, /190/);
  assert.equal(message.includes(secret), false);
  error.response.data.error.code = secret;
  assert.equal(describeError(error).includes(secret), false);
});

test('X errors redact payload and arbitrary Error messages; local authored errors remain actionable', () => {
  const secret = 'NEVER_PRINT_THIS';
  const error = new ApiResponseError(secret, { code: 429, data: { detail: secret }, headers: {} });
  assert.match(describeError(error), /429/);
  assert.equal(describeError(error).includes(secret), false);
  assert.equal(describeError(new Error(secret)).includes(secret), false);
  assert.equal(describeError(new SafeError('Restaurá el estado.')), 'Restaurá el estado.');
  assert.match(describeError({ code: 'ENOSPC', path: secret }), /ENOSPC/);
});
