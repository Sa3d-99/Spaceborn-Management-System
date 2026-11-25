const assert = require('node:assert/strict');
const { test } = require('node:test');
const { sendEmail } = require('../src/services/emailService');

const configuredKey = 'fixture-email-api-key';
const message = { to: 'employee@example.test', subject: 'Reset your password', text: 'Test message' };

test('a sandbox sender rejected by Resend reports the verified-domain requirement without logging recipient data', async t => {
  t.mock.method(global, 'fetch', async () => Response.json({
    name: 'validation_error',
    message: 'You can only send testing emails to your own email address (owner@example.test).'
  }, { status: 403 }));

  await assert.rejects(sendEmail({
    apiKey: configuredKey,
    from: 'Spaceborn <onboarding@resend.dev>'
  }, message), error => {
    assert.match(error.message, /Resend HTTP 403/);
    assert.match(error.message, /RESEND_FROM_EMAIL.*verified sending domain/);
    assert.doesNotMatch(error.message, /owner@example\.test|employee@example\.test|fixture-email-api-key/);
    return true;
  });
});

test('a custom sender rejected by Resend reports domain and key permissions', async t => {
  t.mock.method(global, 'fetch', async () => Response.json({
    name: 'validation_error'
  }, { status: 403 }));

  await assert.rejects(sendEmail({
    apiKey: configuredKey,
    from: 'accounts@example.test'
  }, message), /Resend HTTP 403.*verified.*key.*permission/i);
});
