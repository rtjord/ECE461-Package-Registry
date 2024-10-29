import { S3 } from '@aws-sdk/client-s3';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, PutCommand, GetCommand } from '@aws-sdk/lib-dynamodb';
import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';

const s3 = new S3();
const dynamoDBClient = DynamoDBDocumentClient.from(new DynamoDBClient());

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
    try {
        // Parse the request body
        const requestBody = JSON.parse(event.body || '{}');

        // Extract metadata and data from request body
        const { metadata, data } = requestBody;

        // Validate required fields
        if (!metadata || !metadata.Name || !metadata.Version || !data) {
            return {
                statusCode: 400, // Bad Request
                headers: {
                    'Access-Control-Allow-Origin': '*',
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    message: 'Missing required fields in the request body: metadata and data.',
                }),
            };
        }

        const packageName: string = metadata.Name;
        const version: string = metadata.Version;

        // Ensure either Content or URL is provided, but not both
        if (!data.Content && !data.URL) {
            return {
                statusCode: 400,
                headers: {
                    'Access-Control-Allow-Origin': '*',
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    message: 'Either Content or URL must be provided.',
                }),
            };
        }

        if (data.Content && data.URL) {
            return {
                statusCode: 400, // Bad Request
                headers: {
                    'Access-Control-Allow-Origin': '*',
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    message: 'Both Content and URL cannot be provided at the same time.',
                }),
            };
        }

        // Check if the package already exists
        const getParams = {
            TableName: 'PackageMetaData',
            Key: {
                packageName: packageName,
                version: version,
            },
        };
        const existingPackage = await dynamoDBClient.send(new GetCommand(getParams));

        if (existingPackage.Item) {
            return {
                statusCode: 409, // Conflict
                headers: {
                    'Access-Control-Allow-Origin': '*',
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    message: 'Package already exists.',
                }),
            };
        }

        // Upload content to S3 if provided, otherwise use the URL
        let s3Key: string | null = null;
        let fileUrl: string | null = null;

        if (data.Content) {
            const fileContent = Buffer.from(data.Content, 'base64');
            s3Key = `uploads/${packageName}-${version}.zip`;
            const s3Params = {
                Bucket: process.env.S3_BUCKET_NAME!,
                Key: s3Key,
                Body: fileContent,
                ContentType: 'application/zip',
            };
            await s3.putObject(s3Params);
            fileUrl = `https://${s3Params.Bucket}.s3.amazonaws.com/${s3Params.Key}`;
        } else if (data.URL) {
            fileUrl = data.URL;
        }

        // Store metadata in DynamoDB
        const dynamoDBParams = {
            TableName: 'PackageMetaData',
            Item: {
                packageName: packageName,
                version: version,
                id: `${packageName}-${version}`,  // Use packageName and version to generate ID
                uploadDate: Date.now(),
                s3Key: s3Key ? s3Key : null,
                url: data.URL ? data.URL : null,
                dependencies: [],  // Placeholder for future use
                busFactor: null,   // Placeholder for future use
            },
        };

        await dynamoDBClient.send(new PutCommand(dynamoDBParams));

        // Return success with the package metadata and file URL or URL
        return {
            statusCode: 201, // Created
            headers: {
                'Access-Control-Allow-Origin': '*',
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                message: 'Package uploaded and metadata stored successfully.',
                metadata: {
                    Name: packageName,
                    Version: version,
                    ID: `${packageName}-${version}`,
                },
                data: {
                    Content: fileUrl,
                },
            }),
        };

    } catch (error: any) {
        // Handle any errors during the process
        console.error("Error during POST package:", error);

        return {
            statusCode: 500, // Internal Server Error
            headers: {
                'Access-Control-Allow-Origin': '*',
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                message: 'Failed to upload package.',
                error: error.message,
            }),
        };
    }
};
