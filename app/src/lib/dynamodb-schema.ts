import {
  CreateTableCommand,
  DeleteTableCommand,
  DescribeTableCommand,
  ResourceNotFoundException,
  type DynamoDBClient,
  waitUntilTableExists,
  waitUntilTableNotExists,
} from '@aws-sdk/client-dynamodb';

export async function ensureTable(client: DynamoDBClient, tableName: string): Promise<void> {
  try {
    await client.send(new DescribeTableCommand({ TableName: tableName }));
    return;
  } catch (error) {
    if (!(error instanceof ResourceNotFoundException)) {
      throw error;
    }
  }

  await client.send(
    new CreateTableCommand({
      TableName: tableName,
      BillingMode: 'PAY_PER_REQUEST',
      AttributeDefinitions: [
        { AttributeName: 'PK', AttributeType: 'S' },
        { AttributeName: 'SK', AttributeType: 'S' },
        { AttributeName: 'GSI1PK', AttributeType: 'S' },
        { AttributeName: 'GSI1SK', AttributeType: 'S' },
        { AttributeName: 'GSI2PK', AttributeType: 'S' },
        { AttributeName: 'GSI2SK', AttributeType: 'S' },
      ],
      KeySchema: [
        { AttributeName: 'PK', KeyType: 'HASH' },
        { AttributeName: 'SK', KeyType: 'RANGE' },
      ],
      GlobalSecondaryIndexes: [
        {
          IndexName: 'MapsByUpdatedAt',
          KeySchema: [
            { AttributeName: 'GSI1PK', KeyType: 'HASH' },
            { AttributeName: 'GSI1SK', KeyType: 'RANGE' },
          ],
          Projection: {
            ProjectionType: 'INCLUDE',
            NonKeyAttributes: [
              'mapId',
              'name',
              'description',
              'status',
              'version',
              'isDeleted',
              'createdBy',
              'createdAt',
              'updatedBy',
              'updatedAt',
              'tags',
              'nodeCount',
              'edgeCount',
            ],
          },
        },
        {
          IndexName: 'StatusIndex',
          KeySchema: [
            { AttributeName: 'GSI2PK', KeyType: 'HASH' },
            { AttributeName: 'GSI2SK', KeyType: 'RANGE' },
          ],
          Projection: {
            ProjectionType: 'INCLUDE',
            NonKeyAttributes: [
              'mapId',
              'name',
              'description',
              'status',
              'version',
              'isDeleted',
              'createdBy',
              'createdAt',
              'updatedBy',
              'updatedAt',
              'tags',
              'nodeCount',
              'edgeCount',
            ],
          },
        },
      ],
    })
  );

  await waitUntilTableExists({ client, maxWaitTime: 30 }, { TableName: tableName });
}

export async function deleteTableIfExists(
  client: DynamoDBClient,
  tableName: string
): Promise<void> {
  try {
    await client.send(new DescribeTableCommand({ TableName: tableName }));
  } catch (error) {
    if (error instanceof ResourceNotFoundException) {
      return;
    }

    throw error;
  }

  await client.send(new DeleteTableCommand({ TableName: tableName }));
  await waitUntilTableNotExists({ client, maxWaitTime: 30 }, { TableName: tableName });
}
