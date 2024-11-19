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

        const history: PackageHistoryEntry[] = await getPackageHistory(name);

        // Check if any items were found
        if (history.length === 0) {
            return createErrorResponse(404, `No history found for package: ${name}`);
        }

        return {
            statusCode: 200,
            headers: { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json' },
            body: JSON.stringify(history),
        };
    } catch (error) {
        console.error('Error fetching package history:', error);
        return createErrorResponse(500, 'Failed to fetch package history.');
    }
};

export async function getPackageHistory(packageName: string): Promise<PackageHistoryEntry[]> {
    const params = {
        TableName: "PackageHistoryTable",
        KeyConditionExpression: "#pkgName = :nameVal",
        ExpressionAttributeNames: {
            "#pkgName": "PackageName",
        },
        ExpressionAttributeValues: {
            ":nameVal": packageName,
        },
    };

    // Must use query to get all items with the same partition key
    const command = new QueryCommand(params);
    const result = await dynamoDBClient.send(command);

    return result.Items as PackageHistoryEntry[];
}