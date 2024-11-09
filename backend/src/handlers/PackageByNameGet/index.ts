import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, QueryCommand } from '@aws-sdk/lib-dynamodb';

// Initialize DynamoDB client
const dynamoDBClient = DynamoDBDocumentClient.from(new DynamoDBClient());

export const handler = async (event: any) => {
    try {
        const { name } = event.pathParameters;

        if (!name) {
            return {
                statusCode: 400,
                headers: { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json' },
                body: JSON.stringify({ message: 'Package name is required.' }),
            };
        }

        const queryParams = {
            TableName: 'PackageHistory',
            IndexName: 'PackageNameIndex',  // GSI index name on PackageName
            KeyConditionExpression: '#pkgName = :nameValue',
            ExpressionAttributeNames: {
                '#pkgName': 'PackageName',
            },
            ExpressionAttributeValues: {
                ':nameValue': name,
            },
        };

        const result = await dynamoDBClient.send(new QueryCommand(queryParams));

        if (!result.Items || result.Items.length === 0) {
            return {
                statusCode: 404,
                headers: { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json' },
                body: JSON.stringify({ message: `No history found for package: ${name}` }),
            };
        }

        return {
            statusCode: 200,
            headers: { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json' },
            body: JSON.stringify(result.Items),
        };
    } catch (error) {
        console.error('Error fetching package history:', error);

        return {
            statusCode: 500,
            headers: { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json' },
            body: JSON.stringify({ message: 'Failed to fetch package history.', error: (error as Error).message }),
        };
    }
};
