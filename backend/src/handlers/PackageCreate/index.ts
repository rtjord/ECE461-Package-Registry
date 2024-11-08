import { S3 } from '@aws-sdk/client-s3';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, PutCommand, GetCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';

const s3 = new S3();
const dynamoDBClient = DynamoDBDocumentClient.from(new DynamoDBClient());

export const handler = async (event:any) => {
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

        if (data.PackageRating) {
            const nonLatencyFields = [
                'RampUp',
                'Correctness',
                'BusFactor',
                'ResponsiveMaintainer',
                'LicenseScore',
                'GoodPinningPractice',
                'PullRequest',
                'NetScore'
            ];

            for (const field of nonLatencyFields) {
                if (data.PackageRating[field] === undefined || data.PackageRating[field] < 0.5) {
                    return {
                        statusCode: 424,
                        headers: {
                            'Access-Control-Allow-Origin': '*',
                            'Content-Type': 'application/json',
                        },
                        body: JSON.stringify({ message: `Package is not uploaded due to the disqualified rating. The field '${field}' has a value below 0.5 or is missing.` }),
                    };
                }
            }
        }

        let s3Key = null;
        let fileUrl = null;
        if (data.Content) {
            const fileContent = Buffer.from(data.Content, 'base64');
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

        const dynamoDBParams = {
            TableName: 'PackageMetaData',
            Item: {
                packageName: packageName,
                version: version,
                id: `${packageName}-${version}`,
                uploadDate: Date.now(),
                s3Key: s3Key ? s3Key : null,
                url: data.URL ? data.URL : null,
                dependencies: data.dependencies || [],
                PackageRating: data.PackageRating || null,
                JSProgram: data.JSProgram || null,
                debloat: data.debloat || null,
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
                ID: `${packageName}-${version}`,
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
                    ID: `${packageName}-${version}`,
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
