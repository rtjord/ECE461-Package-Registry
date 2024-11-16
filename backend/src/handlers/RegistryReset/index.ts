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

const dynamoDBClient = new DynamoDBClient({ region: process.env.AWS_REGION });
const s3Client = new S3Client({ region: process.env.AWS_REGION });

// Function to clear a DynamoDB table with a single primary key (e.g., ID)
async function clearDynamoDBTableByPrimaryKey(tableName: string, keyName: string): Promise<void> {
    try {
        console.log(`Starting to clear table: ${tableName} with primary key: ${keyName}`);
        let lastEvaluatedKey: Record<string, any> | undefined = undefined;

        do {
            const scanResult: ScanCommandOutput = await dynamoDBClient.send(
                new ScanCommand({
                    TableName: tableName,
                    ExclusiveStartKey: lastEvaluatedKey,
                })
            );

            const items = scanResult.Items || [];
            const keys = items.map((item) => ({
                DeleteRequest: { Key: { [keyName]: item[keyName] } },
            }));

            if (keys.length > 0) {
                console.log(`Deleting ${keys.length} items.`);
                for (let i = 0; i < keys.length; i += 25) {
                    const batch = keys.slice(i, i + 25);
                    await dynamoDBClient.send(
                        new BatchWriteItemCommand({
                            RequestItems: {
                                [tableName]: batch,
                            },
                        })
                    );
                }
            }

            lastEvaluatedKey = scanResult.LastEvaluatedKey;
        } while (lastEvaluatedKey);

        console.log(`Table ${tableName} has been cleared.`);
    } catch (error) {
        console.error(`Error clearing table ${tableName}:`, error);
        throw new Error(`Failed to clear table: ${tableName}`);
    }
}

// Function to clear a DynamoDB table with partition and sort keys
async function clearDynamoDBTableByPartitionAndSortKey(
    tableName: string,
    partitionKey: string,
    sortKey: string
): Promise<void> {
    try {
        console.log(`Starting to clear table: ${tableName} with keys: ${partitionKey} and ${sortKey}`);
        let lastEvaluatedKey: Record<string, any> | undefined = undefined;

        do {
            const scanResult: ScanCommandOutput = await dynamoDBClient.send(
                new ScanCommand({
                    TableName: tableName,
                    ExclusiveStartKey: lastEvaluatedKey,
                })
            );

            const items = scanResult.Items || [];
            const keys = items.map((item) => ({
                DeleteRequest: { Key: { [partitionKey]: item[partitionKey], [sortKey]: item[sortKey] } },
            }));

            if (keys.length > 0) {
                console.log(`Deleting ${keys.length} items.`);
                for (let i = 0; i < keys.length; i += 25) {
                    const batch = keys.slice(i, i + 25);
                    await dynamoDBClient.send(
                        new BatchWriteItemCommand({
                            RequestItems: {
                                [tableName]: batch,
                            },
                        })
                    );
                }
            }

            lastEvaluatedKey = scanResult.LastEvaluatedKey;
        } while (lastEvaluatedKey);

        console.log(`Table ${tableName} has been cleared.`);
    } catch (error) {
        console.error(`Error clearing table ${tableName}:`, error);
        throw new Error(`Failed to clear table: ${tableName}`);
    }
}

// Function to clear an S3 bucket
async function emptyS3Bucket(bucketName: string): Promise<void> {
    try {
        console.log(`Starting to empty bucket: ${bucketName}`);

        let continuationToken: string | undefined = undefined;
        do {
            const listObjects: ListObjectsV2CommandOutput = await s3Client.send(
                new ListObjectsV2Command({ Bucket: bucketName, ContinuationToken: continuationToken })
            );

            const objects = listObjects.Contents?.map((object) => ({ Key: object.Key })) || [];
            if (objects.length > 0) {
                console.log(`Deleting ${objects.length} objects.`);
                await s3Client.send(
                    new DeleteObjectsCommand({
                        Bucket: bucketName,
                        Delete: { Objects: objects },
                    })
                );
            }

            continuationToken = listObjects.NextContinuationToken;
        } while (continuationToken);

        console.log(`Bucket ${bucketName} has been emptied.`);
    } catch (error) {
        console.error(`Error emptying bucket ${bucketName}:`, error);
        throw new Error(`Failed to empty bucket: ${bucketName}`);
    }
}

// Lambda handler
export const handler: APIGatewayProxyHandler = async () => {
    try {
        // Define table and bucket names
        const table1 = "PackageMetadata"; // Table with ID as the primary key
        const table2 = "PackageHistoryTable"; // Table with partition key and sort key
        const bucket = process.env.S3_BUCKET_NAME; // S3 bucket name
        if (!bucket) {
            throw new Error("S3_BUCKET_NAME environment variable is not set.");
        }

        // Clear the DynamoDB tables
        console.log(`Clearing DynamoDB table: ${table1}`);
        await clearDynamoDBTableByPrimaryKey(table1, "ID");

        console.log(`Clearing DynamoDB table: ${table2}`);
        await clearDynamoDBTableByPartitionAndSortKey(table2, "PackageName", "Date");

        // Empty the S3 bucket
        console.log(`Emptying S3 bucket: ${bucket}`);
        await emptyS3Bucket(bucket);

        console.log("All resources have been cleared successfully.");

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
