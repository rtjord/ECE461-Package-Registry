import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, DeleteCommand, GetCommand } from '@aws-sdk/lib-dynamodb';

const dynamoDBClient = DynamoDBDocumentClient.from(new DynamoDBClient());

export const handler = async (event) => {
    try {
        // Check for X-Authorization header
        // const authHeader = event.headers['X-Authorization'];
        // if (!authHeader) {
        //     return {
        //         statusCode: 403, // Forbidden
        //         headers: {
        //             'Access-Control-Allow-Origin': '*',
        //             'Content-Type': 'application/json',
        //         },
        //         body: JSON.stringify({
        //             message: "Missing Authentication Token.",
        //         }),
        //     };
        // }

        // Extract packageName and version from pathParameters (format: /package/{id})
        const { id } = event.pathParameters;

        // Split the id to extract packageName and version
        const [packageName, version] = id.split(':');

        // Validate the packageName and version
        if (!packageName || !version) {
            return {
                statusCode: 400, // Bad Request
                headers: {
                    'Access-Control-Allow-Origin': '*',
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    message: "Both packageName and version are required.",
                }),
            };
        }

        // Check if the package exists before attempting to delete it
        const getParams = {
            TableName: 'PackageMetaData',
            Key: {
                packageName: packageName,
                version: version,
            },
        };

        const existingPackage = await dynamoDBClient.send(new GetCommand(getParams));
        if (!existingPackage.Item) {
            return {
                statusCode: 404, // Not Found
                headers: {
                    'Access-Control-Allow-Origin': '*',
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    message: `Package ${packageName} version ${version} not found.`,
                }),
            };
        }

        // Proceed to delete the package from DynamoDB
        const deleteParams = {
            TableName: 'PackageMetaData',
            Key: {
                packageName: packageName,
                version: version,
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
        console.error("Error during DELETE:", error);  // Improved logging

        return {
            statusCode: 500, // Internal Server Error
            headers: {
                'Access-Control-Allow-Origin': '*',
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                message: "Failed to delete package.",
                error: error.message,
            }),
        };
    }
};
