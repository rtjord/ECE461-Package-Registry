import { S3, GetObjectCommand, GetObjectCommandOutput } from '@aws-sdk/client-s3';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { createErrorResponse, getPackageById } from './utils';
import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';

// Utility function to fetch S3 object content
async function getS3ObjectContent(
    s3Client: S3,
    bucketName: string,
    key: string
): Promise<{ base64Content: string | null; fileUrl: string | null }> {
    try {
        const s3Object: GetObjectCommandOutput = await s3Client.send(
            new GetObjectCommand({ Bucket: bucketName, Key: key })
        );

        let base64Content: string | null = null;
        const fileUrl = `https://${bucketName}.s3.amazonaws.com/${key}`;

        if (s3Object.Body && typeof (s3Object.Body as any)[Symbol.asyncIterator] === 'function') {
            const chunks: Uint8Array[] = [];
            for await (const chunk of s3Object.Body as any) {
                chunks.push(chunk);
            }
            const fileBuffer = Buffer.concat(chunks);
            base64Content = fileBuffer.toString('base64');
        }

        return { base64Content, fileUrl };
    } catch (error) {
        console.error('Error fetching S3 object:', error);
        return { base64Content: null, fileUrl: null };
    }
}

// Utility function to update the DynamoDB table
async function updatePackageHistory(
    dynamoDBClient: DynamoDBDocumentClient,
    tableName: string,
    packageName: string,
    version: string,
    authorizerClaims: Record<string, any> | null
): Promise<void> {
    const historyParams = {
        TableName: tableName,
        Key: { PackageName: packageName },
        UpdateExpression: 'SET #history = list_append(if_not_exists(#history, :emptyList), :newEvent)',
        ExpressionAttributeNames: {
            '#history': 'history',
        },
        ExpressionAttributeValues: {
            ':emptyList': [],
            ':newEvent': [
                {
                    User: authorizerClaims || { name: 'Unknown', isAdmin: false },
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
        console.error('Failed to update package history:', error);
    }
}

// Main handler with dependency injection
export const handler = async (
    event: APIGatewayProxyEvent,
    dependencies: { s3Client: S3; dynamoDBClient: DynamoDBDocumentClient } = {
        s3Client: new S3(),
        dynamoDBClient: DynamoDBDocumentClient.from(new DynamoDBClient()),
    }
): Promise<APIGatewayProxyResult> => {
    try {
        const id = event.pathParameters?.id;
        if (!id) {
            return createErrorResponse(400, 'Package ID is required.');
        }

        const existingPackage = await getPackageById(id);
        if (!existingPackage) {
            return createErrorResponse(404, 'Package not found.');
        }

        const { PackageName: packageName, Version: version, s3Key, URL: url } = existingPackage;
        const bucketName = process.env.S3_BUCKET_NAME;
        if (!bucketName) {
            throw new Error('S3_BUCKET_NAME environment variable is not set.');
        }

        let base64Content: string | null = null;
        let fileUrl: string | null = null;

        if (s3Key) {
            const s3Result = await getS3ObjectContent(dependencies.s3Client, bucketName, s3Key);
            base64Content = s3Result.base64Content;
            fileUrl = s3Result.fileUrl;
        }

        await updatePackageHistory(
            dependencies.dynamoDBClient,
            'PackageHistoryTable',
            packageName,
            version,
            event.requestContext.authorizer?.claims || null
        );

        const responseBody = {
            metadata: {
                Name: packageName,
                Version: version,
                ID: `${packageName}-${version}`,
            },
            data: {
                Content: base64Content,
                URL: url || fileUrl,
            },
        };

        return {
            statusCode: 200,
            headers: { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json' },
            body: JSON.stringify(responseBody),
        };
    } catch (error) {
        console.error('Error processing request:', error);
        return createErrorResponse(500, 'Failed to retrieve package.');
    }
};
