const { randomUUID } = require('node:crypto');
const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, PutCommand, QueryCommand } = require('@aws-sdk/lib-dynamodb');

// The AWS SDK v3 is built into the Lambda Node.js runtime, so it doesn't need to be zipped with our code.
const db = DynamoDBDocumentClient.from(new DynamoDBClient({}));

// All calculations share one partition key, sorted by time. Simple and fine at this scale;
// a high-traffic app would spread items across many partition keys.
const PARTITION_KEY = 'CALCULATION';
const KEEP_DAYS = 30; // DynamoDB's TTL feature deletes items automatically after this.

async function saveCalculation(result, now = new Date()) {
  const id = randomUUID();
  const createdAt = now.toISOString();

  await db.send(
    new PutCommand({
      TableName: process.env.TABLE_NAME,
      Item: {
        pk: PARTITION_KEY,
        sk: `${createdAt}#${id}`, // sort key: orders by time, unique even within the same millisecond
        id,
        createdAt,
        expiresAt: Math.floor(now.getTime() / 1000) + KEEP_DAYS * 24 * 60 * 60,
        result,
      },
    })
  );

  return { id, createdAt };
}

async function getRecentHistory(limit = 10) {
  const response = await db.send(
    new QueryCommand({
      TableName: process.env.TABLE_NAME,
      KeyConditionExpression: 'pk = :pk',
      ExpressionAttributeValues: { ':pk': PARTITION_KEY },
      ScanIndexForward: false, // newest first
      Limit: limit,
    })
  );

  return (response.Items || []).map(({ id, createdAt, result }) => ({ id, createdAt, result }));
}

module.exports = { saveCalculation, getRecentHistory };
