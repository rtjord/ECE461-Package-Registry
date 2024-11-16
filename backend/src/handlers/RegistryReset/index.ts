import { APIGatewayProxyHandler } from "aws-lambda";
import {
    S3Client,
    ListObjectsV2Command,
    DeleteObjectsCommand,
    ListObjectsV2CommandOutput,
} from "@aws-sdk/client-s3";
import {
    DynamoDBClient,
    ScanCommand,
    BatchWriteItemCommand,
    ScanCommandOutput,
} from "@aws-sdk/client-dynamodb";

// Utility to validate required environment variables
function getEnvVariable(key: string): string {
    const value = process.env[key];
    if (!value) {
        throw new Error(`Environment variable ${key} is not set.`);
    }
    return value;
}

// Reusable function to delete items from DynamoDB in batches
async function deleteDynamoDBItems(
    dynamoDBClient: DynamoDBClient,
    tableName: string,
    keys: { DeleteRequest: { Key: Record<string, any> } }[]
): Promise<void> {
    for (let i = 0; i < keys.length; i += 25) {
        const batch = keys.slice(i, i + 25);
        await dynamoDBClient.send(
            new BatchWriteItemCommand({
                RequestItems: { [tableName]: batch },
            })
        );
    }
}

// Function to clear a DynamoDB table
async function clearDynamoDBTable(
    dynamoDBClient: DynamoDBClient,
    tableName: string,
    keyExtractor: (item: Record<string, any>) => Record<string, any>
): Promise<void> {
    console.log(`Clearing DynamoDB table: ${tableName}`);
    let lastEvaluatedKey: Record<string, any> | undefined;

    do {
        const scanResult: ScanCommandOutput = await dynamoDBClient.send(
            new ScanCommand({ TableName: tableName, ExclusiveStartKey: lastEvaluatedKey })
        );

        const items = scanResult.Items || [];
        const keys = items.map((item) => ({ DeleteRequest: { Key: keyExtractor(item) } }));

        if (keys.length > 0) {
            console.log(`Deleting ${keys.length} items from table: ${tableName}`);
            await deleteDynamoDBItems(dynamoDBClient, tableName, keys);
        }

        lastEvaluatedKey = scanResult.LastEvaluatedKey;
    } while (lastEvaluatedKey);

    console.log(`Table ${tableName} cleared successfully.`);
}

// Function to empty an S3 bucket
async function emptyS3Bucket(
    s3Client: S3Client,
    bucketName: string
): Promise<void> {
    console.log(`Emptying S3 bucket: ${bucketName}`);
    let continuationToken: string | undefined;

    do {
        const listObjects: ListObjectsV2CommandOutput = await s3Client.send(
            new ListObjectsV2Command({ Bucket: bucketName, ContinuationToken: continuationToken })
        );

        const objects = listObjects.Contents?.map((object) => ({ Key: object.Key })) || [];
        if (objects.length > 0) {
            console.log(`Deleting ${objects.length} objects from bucket: ${bucketName}`);
            await s3Client.send(
                new DeleteObjectsCommand({
                    Bucket: bucketName,
                    Delete: { Objects: objects },
                })
            );
        }

        continuationToken = listObjects.NextContinuationToken;
    } while (continuationToken);

    console.log(`Bucket ${bucketName} emptied successfully.`);
}

// Lambda handler
export const handler: APIGatewayProxyHandler = async () => {
    try {
        // Inject clients
        const dynamoDBClient = new DynamoDBClient({ region: process.env.AWS_REGION });
        const s3Client = new S3Client({ region: process.env.AWS_REGION });

        // Define table and bucket names
        const table1 = "PackageMetadata"; // Table with ID as primary key
        const table2 = "PackageHistoryTable"; // Table with partition and sort keys
        const bucket = getEnvVariable("S3_BUCKET_NAME");

        // Perform all operations concurrently
        await Promise.all([
            clearDynamoDBTable(dynamoDBClient, table1, (item) => ({ ID: item.ID })),
            clearDynamoDBTable(dynamoDBClient, table2, (item) => ({
                PackageName: item.PackageName,
                Date: item.Date,
            })),
            emptyS3Bucket(s3Client, bucket),
        ]);

        console.log("All resources cleared successfully.");
        return {
            statusCode: 200,
            body: JSON.stringify({ message: "Tables and bucket cleared successfully." }),
        };
    } catch (error) {
        console.error("Error clearing resources:", error);
        return {
            statusCode: 500,
            body: JSON.stringify({ message: "Failed to clear resources.", error: error }),
        };
    }
};
