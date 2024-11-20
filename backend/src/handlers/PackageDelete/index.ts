import { DynamoDBClient } from '@dependencies/@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, DeleteCommand, GetCommand, QueryCommand, BatchWriteCommand } from '@dependencies/@aws-sdk/lib-dynamodb';
import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { PackageTableRow } from './interfaces';
import { createErrorResponse, getPackageById } from './utils';

const dynamoDBClient = DynamoDBDocumentClient.from(new DynamoDBClient());
const BATCH_SIZE = 25;

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
    try {
        // Extract packageName and version from pathParameters (format: /package/{id})
        const id = event.pathParameters?.id;

        // Validate the packageName and version
        if (!id) {
            return createErrorResponse(400, "Missing ID.");
        }

        const existingPackage = await getPackageById(id);
        if (!existingPackage) {
            return createErrorResponse(404, "Package not found.");
        }

        const packageName = existingPackage.PackageName;
        const version = existingPackage.Version;
        // Proceed to delete the package from PackageMetaData table
        const deleteParams = {
            TableName: 'PackageMetadata',
            Key: {
                ID: id,
            },
        };

        await dynamoDBClient.send(new DeleteCommand(deleteParams));

        return {
            statusCode: 200, // OK
            headers: {
                'Access-Control-Allow-Origin': '*',
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                message: `Package ${packageName} version ${version} deleted successfully.`,
            }),
        };
    } catch (error) {
        console.error("Error during DELETE:", error); // Improved logging
        return createErrorResponse(500, "Failed to delete package.");
    }
};
