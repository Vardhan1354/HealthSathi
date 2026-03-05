'use strict';

const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const {
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
  UpdateCommand,
  DeleteCommand,
  QueryCommand,
  BatchWriteCommand,
} = require('@aws-sdk/lib-dynamodb');

const TABLE = process.env.TABLE_NAME;

const raw = new DynamoDBClient({ region: process.env.AWS_REGION || 'ap-south-1' });
const db  = DynamoDBDocumentClient.from(raw, {
  marshallOptions: { removeUndefinedValues: true },
});

// ─── helpers ────────────────────────────────────────────────────────────────

const put = (item) =>
  db.send(new PutCommand({ TableName: TABLE, Item: item }));

const get = (pk, sk) =>
  db.send(new GetCommand({ TableName: TABLE, Key: { PK: pk, SK: sk } }))
    .then(r => r.Item || null);

const update = (pk, sk, expr, names, values) =>
  db.send(new UpdateCommand({
    TableName: TABLE,
    Key: { PK: pk, SK: sk },
    UpdateExpression: expr,
    ExpressionAttributeNames: names,
    ExpressionAttributeValues: values,
    ReturnValues: 'ALL_NEW',
  })).then(r => r.Attributes);

const query = async (params, pageSize = 50, lastKey = null) => {
  const cmd = {
    TableName: TABLE,
    Limit: pageSize,
    ...params,
  };
  if (lastKey) cmd.ExclusiveStartKey = lastKey;
  const result = await db.send(new QueryCommand(cmd));
  return { items: result.Items || [], lastKey: result.LastEvaluatedKey || null };
};

const queryAll = async (params) => {
  let items = [];
  let lastKey = null;
  do {
    const { items: batch, lastKey: nextKey } = await query(params, 100, lastKey);
    items = items.concat(batch);
    lastKey = nextKey;
  } while (lastKey);
  return items;
};

const queryGSI1 = (gsi1pk, skPrefix = null, pageSize = 50, lastKey = null) => {
  const params = {
    IndexName: 'GSI1',
    KeyConditionExpression: skPrefix
      ? 'GSI1PK = :pk AND begins_with(GSI1SK, :prefix)'
      : 'GSI1PK = :pk',
    ExpressionAttributeValues: skPrefix
      ? { ':pk': gsi1pk, ':prefix': skPrefix }
      : { ':pk': gsi1pk },
  };
  return query(params, pageSize, lastKey);
};

const batchWrite = (items) => {
  const chunks = [];
  for (let i = 0; i < items.length; i += 25) chunks.push(items.slice(i, i + 25));
  return Promise.all(chunks.map(chunk =>
    db.send(new BatchWriteCommand({
      RequestItems: {
        [TABLE]: chunk.map(Item => ({ PutRequest: { Item } })),
      },
    }))
  ));
};

module.exports = { put, get, update, query, queryAll, queryGSI1, batchWrite };
