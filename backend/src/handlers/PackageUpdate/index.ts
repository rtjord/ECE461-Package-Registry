import { S3 } from '@aws-sdk/client-s3';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { getPackageById } from '../../utils';
import { APIGatewayProxyEvent } from 'aws-lambda';

const s3 = new S3();
const dynamoDBClient = DynamoDBDocumentClient.from(new DynamoDBClient());

interface PathParameters {
    id: string;
}

interface RequestBody {
    metadata: {
        Name: string;
        Version: string;
        JSProgram?: string;
    };
    data: {
        Content?: string;
        URL?: string;
    };
}


export const handler = async (event: APIGatewayProxyEvent) => {
    try {
        // Extract packageName and version from the path (assuming package id is passed in the path)
        const id = event.pathParameters?.id;
        
        if (!id || !event.body) { 
            return {
                statusCode: 400, // Bad Request
                headers: {
                    'Access-Control-Allow-Origin': '*',
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    message: "Missing ID.",
                }),
            };
        }
        
        // Parse request body
        const requestBody: RequestBody = JSON.parse(event.body);
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

        const existingPackage = await getPackageById(id);
        if (!existingPackage) {
            return {
                statusCode: 404,
                body: JSON.stringify({
                    message: `Package not found.`,
                }),
            };
        }

        const packageName = metadata.Name;
        const version = metadata.Version;

        let s3Key: string | null = null;
        let fileUrl: string | null = null;

        if (data.Content) {
            // If Content is provided, decode the base64-encoded file content
            const fileContent = Buffer.from(data.Content, 'base64');

            // Upload file to S3 using packageName and version in the S3 key
            s3Key = `uploads/${packageName}-${version}.zip`;
            const s3Params = {
                Bucket: process.env.S3_BUCKET_NAME as string,
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
            UpdateExpression: 'SET #url = :url, s3Key = :s3Key, #jsProgram = :jsProgram',
            ExpressionAttributeNames: {
                '#url': 'url',
                '#jsProgram': 'JSProgram',
            },
            ExpressionAttributeValues: {
                ':url': fileUrl,
                ':s3Key': s3Key,
                ':jsProgram': metadata.JSProgram || null,
            },
            ReturnValues: 'UPDATED_NEW' as const,
        };

        await dynamoDBClient.send(new UpdateCommand(updateParams));
        const historyParams = {
            TableName: 'PackageHistory',
            Key: { PackageName: packageName },
            UpdateExpression: 'SET #history = list_append(if_not_exists(#history, :emptyList), :newEvent)',
            ExpressionAttributeNames: { '#history': 'history' },
            ExpressionAttributeValues: {
                ':emptyList': [],
                ':newEvent': [{
                    User: { name: 'PlaceholderUser', isAdmin: true }, // Replace with actual user data
                    Date: new Date().toISOString(),
                    PackageMetadata: { Name: packageName, Version: version, ID: `${packageName}-${version}` },
                    Action: 'UPDATE',
                }],
            },
        };
        await dynamoDBClient.send(new UpdateCommand(historyParams));
        
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
                error: (error as Error).message,
            }),
        };
    }
};
