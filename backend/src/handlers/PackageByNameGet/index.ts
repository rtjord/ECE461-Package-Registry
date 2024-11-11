import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, QueryCommand } from '@aws-sdk/lib-dynamodb';
import { APIGatewayProxyResult, APIGatewayEvent } from 'aws-lambda';
import { createErrorResponse } from './utils';
import { PackageHistoryEntry } from './interfaces';

// Initialize DynamoDB client
const dynamoDBClient = DynamoDBDocumentClient.from(new DynamoDBClient());

export const handler = async (event: APIGatewayEvent): Promise<APIGatewayProxyResult> => {
    try {
        const name = event.pathParameters?.name;

        if (!name) {
            return createErrorResponse(400, 'Package name is required.');
        }

        // Must use query to get all items with the same partition key
        const params = {
            TableName: "PackageHistoryTable",
            KeyConditionExpression: "#pkgName = :nameVal",
            ExpressionAttributeNames: {
                "#pkgName": "PackageName",
            },
            ExpressionAttributeValues: {
                ":nameVal": name,
            },
        };

        const command = new QueryCommand(params);
        const result = await dynamoDBClient.send(command);

        // Check if any items were found
        if (!result.Items || result.Items.length === 0) {
            return createErrorResponse(404, `No history found for package: ${name}`);
        }

        const packageHistory = result.Items as PackageHistoryEntry[];

        return {
            statusCode: 200,
            headers: { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json' },
            body: JSON.stringify(packageHistory),
        };
    } catch (error) {
        console.error('Error fetching package history:', error);
        return createErrorResponse(500, 'Failed to fetch package history.');
    }
};
