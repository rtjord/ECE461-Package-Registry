import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand } from '@aws-sdk/lib-dynamodb';

const dynamoDBClient = DynamoDBDocumentClient.from(new DynamoDBClient());

export const handler = async (event) => {
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

        // Query DynamoDB using packageName (Partition Key) and version (Sort Key)
        const dynamoDBParams = {
            TableName: 'PackageMetaData',
            Key: {
                packageName: packageName,
                version: version,
            },
        };

        const result = await dynamoDBClient.send(new GetCommand(dynamoDBParams));

        // If the package is not found, return a 404 error
        if (!result.Item) {
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

        // Extract metadata and other relevant fields
        const { s3Key, url } = result.Item;
        let fileUrl = s3Key ? `https://${process.env.S3_BUCKET_NAME}.s3.amazonaws.com/${s3Key}` : null;

        // Build the response body to match the YAML spec
        const responseBody = {
            metadata: {
                Name: packageName,
                Version: version,
                ID: `${packageName}-${version}`,
            },
            data: {
                Content: fileUrl ? fileUrl : null,
                URL: url ? url : null,
            },
        };

        // Return the package metadata and content (or URL)
        return {
            statusCode: 200, // OK
            headers: {
                'Access-Control-Allow-Origin': '*',
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(responseBody),
        };
    } catch (error) {
        // Log the error and return a 500 Internal Server Error
        console.log("Error:", error);

        return {
            statusCode: 500, // Internal Server Error
            headers: {
                'Access-Control-Allow-Origin': '*',
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                message: "Failed to retrieve package.",
                error: error.message,
            }),
        };
    }
};
