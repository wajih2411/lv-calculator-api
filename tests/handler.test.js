const { handler } = require('../src/handler');

describe('Lambda handler', () => {
  test('returns 200 with results for a valid request', async () => {
    const res = await handler({ body: JSON.stringify({ cameraCount: 10, resolution: '1080p', retentionDays: 30 }) });
    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body).storageTB).toBe(12.96);
  });

  test('returns 400 for bad input', async () => {
    const res = await handler({ body: JSON.stringify({ cameraCount: -1 }) });
    expect(res.statusCode).toBe(400);
    expect(JSON.parse(res.body).error).toMatch('cameraCount');
  });

  test('returns 400 for invalid JSON', async () => {
    const res = await handler({ body: 'not json' });
    expect(res.statusCode).toBe(400);
  });
});

describe('Lambda handler errors', () => {
  test('returns 500 with a generic message for unexpected errors', async () => {
    jest.resetModules();
    jest.doMock('../src/calculator', () => ({
      ...jest.requireActual('../src/calculator'),
      calculateCameraSystem: () => {
        throw new Error('something broke');
      },
    }));
    jest.spyOn(console, 'error').mockImplementation(() => {});

    const { handler: brokenHandler } = require('../src/handler');
    const res = await brokenHandler({ body: '{}' });

    expect(res.statusCode).toBe(500);
    expect(JSON.parse(res.body).error).toBe('Internal server error');
  });
});
