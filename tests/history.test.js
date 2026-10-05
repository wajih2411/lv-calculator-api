// Fake the DynamoDB client so we can check exactly what would be sent to AWS.
const mockSend = jest.fn();
jest.mock('@aws-sdk/lib-dynamodb', () => {
  const actual = jest.requireActual('@aws-sdk/lib-dynamodb');
  return { ...actual, DynamoDBDocumentClient: { from: () => ({ send: mockSend }) } };
});

const { PutCommand, QueryCommand } = require('@aws-sdk/lib-dynamodb');
const { saveCalculation, getRecentHistory } = require('../src/history');

beforeEach(() => {
  mockSend.mockReset();
  process.env.TABLE_NAME = 'test-table';
});

test('saveCalculation writes the item with a 30-day expiry', async () => {
  mockSend.mockResolvedValue({});
  const now = new Date('2026-01-01T00:00:00.000Z');
  const saved = await saveCalculation({ storageTB: 12.96 }, now);

  const command = mockSend.mock.calls[0][0];
  expect(command).toBeInstanceOf(PutCommand);
  expect(command.input.TableName).toBe('test-table');
  expect(command.input.Item.pk).toBe('CALCULATION');
  expect(command.input.Item.result).toEqual({ storageTB: 12.96 });
  expect(command.input.Item.expiresAt).toBe(now.getTime() / 1000 + 30 * 86400);
  expect(saved.createdAt).toBe('2026-01-01T00:00:00.000Z');
});

test('getRecentHistory queries newest first and returns clean items', async () => {
  mockSend.mockResolvedValue({ Items: [{ pk: 'CALCULATION', sk: 'x', id: '1', createdAt: 't', result: {}, expiresAt: 1 }] });
  const items = await getRecentHistory(5);

  const command = mockSend.mock.calls[0][0];
  expect(command).toBeInstanceOf(QueryCommand);
  expect(command.input.ScanIndexForward).toBe(false);
  expect(command.input.Limit).toBe(5);
  expect(items).toEqual([{ id: '1', createdAt: 't', result: {} }]);
});
