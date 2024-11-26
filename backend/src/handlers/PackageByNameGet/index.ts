import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import { APIGatewayProxyResult, APIGatewayEvent } from 'aws-lambda';


const utilsPath = process.env.UTILS_PATH || '/common/utils';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { createErrorResponse, getPackageHistory } = require(utilsPath);

const interfacesPath = process.env.INTERFACES_PATH || '/common/interfaces';
/* eslint-disable @typescript-eslint/no-require-imports, @typescript-eslint/no-unused-vars */
const interfaces = require(interfacesPath);
type PackageHistoryEntry = typeof interfaces.PackageHistoryEntry;

export const handler = async (event: APIGatewayEvent): Promise<APIGatewayProxyResult> => {
    try {
        const dynamoDBClient = DynamoDBDocumentClient.from(new DynamoDBClient());

        const name = event.pathParameters?.name;

        if (!name) {
            return createErrorResponse(400, 'Package name is required.');
        }

        const history: PackageHistoryEntry[] = await getPackageHistory(dynamoDBClient, name);

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
