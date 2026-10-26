import { expect, test } from './support/diagnostics';
import { hasManagedSmokeStack } from './support/stack';

test('API rejects forged browser mutations and throttles credential attempts', async ({
  request,
}) => {
  test.skip(
    !hasManagedSmokeStack(),
    'Requires the disposable managed smoke stack.',
  );
  const forged = await request.post('/api/guest-users', {
    headers: { Origin: 'https://attacker.invalid' },
    data: { name: 'Rejected origin' },
  });
  expect(forged.status()).toBe(403);
  const opaque = await request.post('/api/guest-users', {
    headers: { Origin: 'null' },
    data: { name: 'Rejected opaque origin' },
  });
  expect(opaque.status()).toBe(403);
  for (let attempt = 0; attempt < 20; attempt++) {
    const response = await request.post('/auth/login', {
      data: {
        email: 'absent-security-fixture@example.invalid',
        password: 'invalid-fixture-password',
      },
    });
    expect(response.status()).toBe(401);
  }
  const throttled = await request.post('/auth/register', {
    data: {
      email: 'absent-security-fixture@example.invalid',
      password: 'invalid-fixture-password',
    },
  });
  expect(throttled.status()).toBe(429);
  expect(Number(throttled.headers()['retry-after'])).toBeGreaterThan(0);
  expect((await request.get('/api/system/health')).status()).toBe(200);
});
