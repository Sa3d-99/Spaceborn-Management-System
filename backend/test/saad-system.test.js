const assert = require('node:assert/strict');
const { once } = require('node:events');
const { after, before, test } = require('node:test');

delete process.env.DATABASE_URL;
delete process.env.VERCEL;
process.env.NODE_ENV = 'production';
process.env.PGLITE_DATA_DIR = 'memory://';
process.env.SEED_DEMO_DATA = 'false';
process.env.JWT_SECRET = 'independent-system-qa-token-secret';
process.env.APP_URL = 'https://crm.example.test';
process.env.REQUIRE_TWO_FACTOR_AUTH = 'false';

const app = require('../src/app');
const connectDB = require('../src/config/db');

let server;
let database;
let origin;

before(async () => {
  database = await connectDB();
  server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  origin = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  if (server) await new Promise(resolve => server.close(resolve));
  if (database) await database.close();
});

test('BUG-060 production CORS only accepts the official frontend and same-origin Docker requests', async () => {
  for (const website of [process.env.APP_URL, origin, 'https://unapproved.example.test']) {
    const allowed = website !== 'https://unapproved.example.test';
    const headers = { Origin: website };
    const preflight = await fetch(origin + '/api/auth/login', {
      method: 'OPTIONS',
      headers: { ...headers, 'Access-Control-Request-Method': 'POST', 'Access-Control-Request-Headers': 'content-type' }
    });
    assert.equal(preflight.status, allowed ? 204 : 403);
    assert.equal(preflight.headers.get('access-control-allow-origin'), allowed ? website : null);
    const direct = await fetch(origin + '/api/health', { headers });
    assert.equal(direct.status, allowed ? 200 : 403);
    assert.equal(direct.headers.get('access-control-allow-origin'), allowed ? website : null);
  }
});

test('BUG-102 unknown API routes return JSON with HTTP 404', async () => {
  const result = await fetch(origin + '/api/unknown-fixture');
  assert.equal(result.status, 404);
  assert.match(result.headers.get('content-type'), /application\/json/);
  assert.deepEqual(await result.json(), { success: false, message: 'API route not found.' });
});


test('authentication and reset validation return clear JSON errors', async () => {
  const cases = [
    ['/login', {}, 'Please provide employee ID and password'],
    ['/forgot-password', {}, 'Employee ID is required'],
    ['/forgot-password', { employeeId: 'PM01' }, 'Enter a valid employee ID or email address.'],
    ['/reset-password/validate', { token: 'invalid' }, 'This reset link is invalid or has expired']
  ];
  for (const [route, body, message] of cases) {
    const response = await fetch(origin + '/api/auth' + route, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body)
    });
    assert.equal(response.status, 400);
    assert.equal((await response.json()).message, message);
  }
});
