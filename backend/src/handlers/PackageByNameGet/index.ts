import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import { APIGatewayProxyResult, APIGatewayEvent } from 'aws-lambda';

const commonPath = process.env.COMMON_PATH || '/opt/nodejs/common';
const { createErrorResponse } = require(`${commonPath}/utils`);
const { getPackageHistory } = require(`${commonPath}/dynamodb`);
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const interfaces = require(`${commonPath}/interfaces`);
type PackageHistoryEntry = typeof interfaces.PackageHistoryEntry;

export const handler = async (event: APIGatewayEvent): Promise<APIGatewayProxyResult> => {
    try {
        const dynamoDBClient = DynamoDBDocumentClient.from(new DynamoDBClient());

        const name = event.pathParameters?.name;

        if (!name) {
            console.error('Package name is required.');
            return createErrorResponse(400, 'Package name is required.');
        }

        const history: PackageHistoryEntry[] = await getPackageHistory(dynamoDBClient, name);
        console.log('Package history:', history);

        // Check if any items were found
        if (history.length === 0) {
            console.error(`No history found for package: ${name}`);
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
