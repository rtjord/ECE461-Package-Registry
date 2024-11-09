import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, DeleteCommand, GetCommand, QueryCommand, BatchWriteCommand } from '@aws-sdk/lib-dynamodb';

const dynamoDBClient = DynamoDBDocumentClient.from(new DynamoDBClient());
const BATCH_SIZE = 25;

export const handler = async (event: { pathParameters: { id: string }; headers: { [key: string]: string } }) => {
    try {
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

        // Proceed to delete the package from PackageMetaData table
        const deleteParams = {
            TableName: 'PackageMetaData',
            Key: {
                packageName: packageName,
                version: version,
            },
        };

        await dynamoDBClient.send(new DeleteCommand(deleteParams));

        // Delete associated history from the PackageHistory table
        let lastEvaluatedKey = undefined;
        do {
            const queryParams: {
                TableName: string;
                KeyConditionExpression: string;
                ExpressionAttributeValues: { [key: string]: string };
                ExclusiveStartKey?: { [key: string]: any };
            } = {
                TableName: 'PackageHistory',
                KeyConditionExpression: 'PackageName = :packageName',
                ExpressionAttributeValues: {
                    ':packageName': packageName,
                },
                ExclusiveStartKey: lastEvaluatedKey,
            };

            const queryResult = await dynamoDBClient.send(new QueryCommand(queryParams));

            if (queryResult.Items && queryResult.Items.length > 0) {
                for (let i = 0; i < queryResult.Items.length; i += BATCH_SIZE) {
                    const batch = queryResult.Items.slice(i, i + BATCH_SIZE);
                    const deleteRequests = batch.map(item => ({
                        DeleteRequest: {
                            Key: {
                                PackageName: item.PackageName,
                            },
                        },
                    }));

                    const batchWriteParams = {
                        RequestItems: {
                            PackageHistory: deleteRequests,
                        },
                    };

                    await dynamoDBClient.send(new BatchWriteCommand(batchWriteParams));
                }
            }

            lastEvaluatedKey = queryResult.LastEvaluatedKey;
        } while (lastEvaluatedKey);

        return {
            statusCode: 200, // OK
            headers: {
                'Access-Control-Allow-Origin': '*',
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                message: `Package ${packageName} version ${version} and associated history deleted successfully.`,
            }),
        };
    } catch (error) {
        console.error("Error during DELETE:", error); // Improved logging

        return {
            statusCode: 500, // Internal Server Error
            headers: {
                'Access-Control-Allow-Origin': '*',
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                message: "Failed to delete package and associated history.",
                error: (error as Error).message,
            }),
        };
    }
};
