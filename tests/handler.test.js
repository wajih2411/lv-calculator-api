// Replace the real database module with fakes so tests never touch AWS.
jest.mock('../src/history', () => ({
  saveCalculation: jest.fn().mockResolvedValue({ id: 'test-id', createdAt: '2026-01-01T00:00:00.000Z' }),
  getRecentHistory: jest.fn().mockResolvedValue([]),
}));

const { handler } = require('../src/handler');
const history = require('../src/history');

describe('Lambda handler: POST /calculate', () => {
  test('returns 200 with results for a valid request', async () => {
    const res = await handler({ routeKey: 'POST /calculate', body: JSON.stringify({ cameraCount: 10, resolution: '1080p', retentionDays: 30 }) });
    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body).storageTB).toBe(12.96);
  });

  test('saves the result and returns its id', async () => {
    const res = await handler({ routeKey: 'POST /calculate', body: JSON.stringify({ cameraCount: 10, resolution: '1080p', retentionDays: 30 }) });
    expect(history.saveCalculation).toHaveBeenCalled();
    expect(JSON.parse(res.body).id).toBe('test-id');
  });

  test('returns 400 for bad input and does not save', async () => {
    history.saveCalculation.mockClear();
    const res = await handler({ routeKey: 'POST /calculate', body: JSON.stringify({ cameraCount: -1 }) });
    expect(res.statusCode).toBe(400);
    expect(JSON.parse(res.body).error).toMatch('cameraCount');
    expect(history.saveCalculation).not.toHaveBeenCalled();
  });

  test('returns 400 for invalid JSON', async () => {
    const res = await handler({ routeKey: 'POST /calculate', body: 'not json' });
    expect(res.statusCode).toBe(400);
  });

  test('returns 500 if saving to the database fails', async () => {
    history.saveCalculation.mockRejectedValueOnce(new Error('DynamoDB unavailable'));
    jest.spyOn(console, 'error').mockImplementation(() => {});
    const res = await handler({ routeKey: 'POST /calculate', body: JSON.stringify({ cameraCount: 10, resolution: '1080p', retentionDays: 30 }) });
    expect(res.statusCode).toBe(500);
    expect(JSON.parse(res.body).error).toBe('Internal server error');
  });
});

describe('Lambda handler: GET /history', () => {
  test('returns recent items with a default limit of 10', async () => {
    history.getRecentHistory.mockResolvedValueOnce([{ id: 'a' }, { id: 'b' }]);
    const res = await handler({ routeKey: 'GET /history' });
    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body).count).toBe(2);
    expect(history.getRecentHistory).toHaveBeenLastCalledWith(10);
  });

  test('accepts a custom limit', async () => {
    await handler({ routeKey: 'GET /history', queryStringParameters: { limit: '5' } });
    expect(history.getRecentHistory).toHaveBeenLastCalledWith(5);
  });

  test('rejects a limit over 50', async () => {
    const res = await handler({ routeKey: 'GET /history', queryStringParameters: { limit: '500' } });
    expect(res.statusCode).toBe(400);
  });
});
