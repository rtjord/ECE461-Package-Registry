import { S3 } from '@aws-sdk/client-s3';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { createErrorResponse, getPackageById } from './utils';
import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { create } from 'ts-node';

const s3 = new S3();
const dynamoDBClient = DynamoDBDocumentClient.from(new DynamoDBClient());

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
    try {
        const id = event.pathParameters?.id;

        if (!id) {
            return createErrorResponse(400, "Both packageName and version are required.");
        }
        
        const existingPackage = await getPackageById(id);

        if (!existingPackage) {
            return createErrorResponse(404, "Package not found.");
        }

        const packageName = existingPackage.PackageName;
        const version = existingPackage.Version;
        const s3Key = existingPackage.s3Key;
        const url = existingPackage.URL;
        let base64Content = null;
        let fileUrl = null;
        if (s3Key) {
            try {
                const s3Object = await s3.getObject({ Bucket: process.env.S3_BUCKET_NAME, Key: s3Key });
                
                if (s3Object.Body && typeof (s3Object.Body as any)[Symbol.asyncIterator] === 'function') {
                    const chunks = [];
                    for await (const chunk of s3Object.Body as any) {
                        chunks.push(chunk);
                    }
                    const fileBuffer = Buffer.concat(chunks);
                    base64Content = fileBuffer.toString('base64');
                    fileUrl = `https://${process.env.S3_BUCKET_NAME}.s3.amazonaws.com/${s3Key}`;
                } else {
                    fileUrl = `https://${process.env.S3_BUCKET_NAME}.s3.amazonaws.com/${s3Key}`;
                    throw new Error('S3 object body is not an async iterable or is undefined');
                }
            } catch (error) {
                fileUrl = null;
                console.error('Error fetching S3 object:', error);
                // Handle the error appropriately, possibly returning an error response
            }
        }

        // Update PackageHistory table
        const historyParams = {
            TableName: 'PackageHistory',
            Key: { PackageName: packageName },
            UpdateExpression: 'SET #history = list_append(if_not_exists(#history, :emptyList), :newEvent)',
            ExpressionAttributeNames: {
                '#history': 'history',
            },
            ExpressionAttributeValues: {
                ':emptyList': [],
                ':newEvent': [
                    {
                        User: event.requestContext.authorizer?.claims || { name: 'Unknown', isAdmin: false },
                        Date: new Date().toISOString(),
                        PackageMetadata: { Name: packageName, Version: version, ID: `${packageName}-${version}` },
                        Action: 'DOWNLOAD',
                    },
                ],
            },
        };

        try {
            await dynamoDBClient.send(new UpdateCommand(historyParams));
        } catch (error) {
            console.error("Failed to update package history:", error);
        }

        const responseBody = {
            metadata: {
                Name: packageName,
                Version: version,
                ID: `${packageName}-${version}`,
            },
            data: {
                Content: base64Content || null,
                URL: url || null,
            },
        };

        return {
            statusCode: 200,
            headers: { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json' },
            body: JSON.stringify(responseBody),
        };
    } catch (error) {
        console.error("Error:", error);
        return createErrorResponse(500, "Failed to retrieve package.");
    }
};
