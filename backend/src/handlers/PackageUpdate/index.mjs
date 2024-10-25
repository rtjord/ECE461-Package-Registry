import { S3 } from '@aws-sdk/client-s3';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, PutCommand, GetCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';

const s3 = new S3();
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
        //             message: "Missing Authorization.",
        //         }),
        //     };
        // }

        // Extract packageName and version from the path (assuming package id is passed in the path)
        const { id } = event.pathParameters;
        const [packageName, version] = id.split(':');

        // Parse request body
        const requestBody = JSON.parse(event.body);
        const { metadata, data } = requestBody;

        // Validate required fields in the request body
        if (!metadata || !metadata.Name || !metadata.Version || !data) {
            return {
                statusCode: 400,
                body: JSON.stringify({
                    message: 'Missing required fields in the request body: metadata and data.',
                }),
            };
        }

        // Check if the package exists
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
                statusCode: 404,
                body: JSON.stringify({
                    message: `Package ${packageName} version ${version} not found.`,
                }),
            };
        }

        let s3Key = null;
        let fileUrl = null;

        if (data.Content) {
            // If Content is provided, decode the base64-encoded file content
            const fileContent = Buffer.from(data.Content, 'base64');

            // Upload file to S3 using packageName and version in the S3 key
            s3Key = `uploads/${packageName}-${version}.zip`;
            const s3Params = {
                Bucket: process.env.S3_BUCKET_NAME,
                Key: s3Key,
                Body: fileContent,
                ContentType: 'application/zip',
            };
            await s3.putObject(s3Params);

            fileUrl = `https://${s3Params.Bucket}.s3.amazonaws.com/${s3Params.Key}`;
        } else if (data.URL) {
            // If URL is provided, use it directly
            fileUrl = data.URL;
        }

        // Update metadata in DynamoDB
        const updateParams = {
            TableName: 'PackageMetaData',
            Key: {
                packageName: packageName,
                version: version,
            },
            UpdateExpression: 'SET #url = :url, s3Key = :s3Key',
            ExpressionAttributeNames: {
                '#url': 'url', // Escape reserved keyword
            },
            ExpressionAttributeValues: {
                ':url': fileUrl, // Either URL or S3 URL
                ':s3Key': s3Key, // S3 key if uploaded, null otherwise
            },
            ReturnValues: 'UPDATED_NEW',
        };

        await dynamoDBClient.send(new UpdateCommand(updateParams));

        return {
            statusCode: 200, // Success
            headers: {
                'Access-Control-Allow-Origin': '*',
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                message: 'Package updated successfully',
                fileUrl: fileUrl,
            }),
        };
    } catch (error) {
        return {
            statusCode: 500, // Internal Server Error
            headers: {
                'Access-Control-Allow-Origin': '*',
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                message: 'Failed to update package.',
                error: error.message,
            }),
        };
    }
};
