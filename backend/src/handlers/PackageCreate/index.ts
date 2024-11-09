import { S3 } from '@aws-sdk/client-s3';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, PutCommand, GetCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { v5 as uuidv5 } from 'uuid';

const s3 = new S3();
const dynamoDBClient = DynamoDBDocumentClient.from(new DynamoDBClient());

import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';

function generatePackageUUID(packageName: string, version: string): string {
    const namespace = '12345678-1234-5678-1234-567812345678';  // Example namespace UUID
    return uuidv5(`${packageName}:${version}`, namespace);
}

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
    try {
        if (!event.body) {
            return {
                statusCode: 400,
                headers: {
                    'Access-Control-Allow-Origin': '*',
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    message: 'Request body is missing.',
                }),
            };
        }

        const requestBody = JSON.parse(event.body);
        const { metadata, data, user } = requestBody;

        if (!metadata || !metadata.Name || !metadata.Version || !data || !user) {
            return {
                statusCode: 400,
                headers: {
                    'Access-Control-Allow-Origin': '*',
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ message: 'Missing required fields in the request body.' }),
            };
        }

        const packageName = metadata.Name;
        const version = metadata.Version;

        if ((!data.Content && !data.URL) || (data.Content && data.URL)) {
            return {
                statusCode: 400,
                headers: {
                    'Access-Control-Allow-Origin': '*',
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ message: 'Exactly one of Content or URL must be provided.' }),
            };
        }

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
                statusCode: 409,
                headers: {
                    'Access-Control-Allow-Origin': '*',
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ message: 'Package already exists.' }),
            };
        }

        // if (data.PackageRating) {
        //     const nonLatencyFields = [
        //         'RampUp',
        //         'Correctness',
        //         'BusFactor',
        //         'ResponsiveMaintainer',
        //         'LicenseScore',
        //         'GoodPinningPractice',
        //         'PullRequest',
        //         'NetScore'
        //     ];

        //     for (const field of nonLatencyFields) {
        //         if (data.PackageRating[field] === undefined || data.PackageRating[field] < 0.5) {
        //             return {
        //                 statusCode: 424,
        //                 headers: {
        //                     'Access-Control-Allow-Origin': '*',
        //                     'Content-Type': 'application/json',
        //                 },
        //                 body: JSON.stringify({ message: `Package is not uploaded due to the disqualified rating. The field '${field}' has a value below 0.5 or is missing.` }),
        //             };
        //         }
        //     }
        // }
        let fileUrl: string | null = null;
        let s3Key = null;
        let fileSizeInMB = 0;
        if (data.Content) {
            const fileContent = Buffer.from(data.Content, 'base64');
            fileSizeInMB = fileContent.length / (1024 * 1024);
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
            fileUrl = data.URL;
        }

        const packageUUID = generatePackageUUID(packageName, version);
        const dynamoDBParams = {
            TableName: 'PackageTable',
            Item: {
                PackageName: packageName,
                Version: version,
                ID: packageUUID,
                URL: fileUrl,
                s3Key: s3Key ? s3Key : null,
                debloat: data.debloat || null,
                JSProgram: data.JSProgram || null,
                standaloneCost: fileSizeInMB,
            },
        };

        await dynamoDBClient.send(new PutCommand(dynamoDBParams));

        // Append the event to the history array for the given package
        const historyEntry = {
            User: user,
            Date: new Date().toISOString(),
            PackageMetadata: {
                Name: packageName,
                Version: version,
                ID: packageUUID,
            },
            Action: 'CREATE',
        };

        const historyUpdateParams = {
            TableName: 'PackageHistory',
            Key: { PackageName: packageName },
            UpdateExpression: 'SET history = list_append(if_not_exists(history, :emptyList), :newEvent)',
            ExpressionAttributeValues: {
                ':newEvent': [historyEntry],
                ':emptyList': [],
            },
        };

        await dynamoDBClient.send(new UpdateCommand(historyUpdateParams));

        return {
            statusCode: 201,
            headers: {
                'Access-Control-Allow-Origin': '*',
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                message: 'Package uploaded and metadata stored successfully.',
                metadata: {
                    Name: packageName,
                    Version: version,
                    ID: packageUUID,
                },
                data: {
                    Content: fileUrl,
                    JSProgram: data.JSProgram || null,
                },
            }),
        };

    } catch (error) {
        console.error("Error during POST package:", error);
        return {
            statusCode: 500,
            headers: {
                'Access-Control-Allow-Origin': '*',
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ message: 'Failed to upload package.', error: (error as Error).message }),
        };
    }
};
