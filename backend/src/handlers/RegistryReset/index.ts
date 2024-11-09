import { S3, ListObjectsV2Command , ListObjectsV2CommandOutput} from '@aws-sdk/client-s3';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, ScanCommand, BatchWriteCommand } from '@aws-sdk/lib-dynamodb';

const s3 = new S3();
const dynamoDBClient = DynamoDBDocumentClient.from(new DynamoDBClient());

const BATCH_SIZE = 25;
const bucketName = process.env.S3_BUCKET_NAME; 

// Table schemas definition
const TABLE_SCHEMAS = {
    PackageMetaData: {
        primaryKey: 'packageName',
        sortKey: 'version'
    },
    PackageHistory: {
        primaryKey: 'PackageName',
    }
};

const clearTable = async (tableName: keyof typeof TABLE_SCHEMAS) => {
    if (!tableName || !TABLE_SCHEMAS[tableName]) {
        throw new Error(`Invalid table name or schema not defined for: ${tableName}`);
    }

    const schema = TABLE_SCHEMAS[tableName];
    let totalDeletedItems = 0;
    let lastEvaluatedKey = undefined;

    try {
        do {
            const scanParams: { TableName: string; ExclusiveStartKey?: Record<string, any> } = {
                TableName: tableName,
                ExclusiveStartKey: lastEvaluatedKey,
            };

            const scanResult = await dynamoDBClient.send(new ScanCommand(scanParams));

            if (!scanResult.Items || scanResult.Items.length === 0) {
                console.log(`No items found in ${tableName}`);
                break;
            }

            for (let i = 0; i < scanResult.Items.length; i += BATCH_SIZE) {
                const batch = scanResult.Items.slice(i, i + BATCH_SIZE);

                const deleteRequests = batch.map(item => {
                    const key = { [schema.primaryKey]: item[schema.primaryKey] };
                    if ('sortKey' in schema && item[schema.sortKey]) {
                        key[schema.sortKey] = item[schema.sortKey];
                    }
                    return { DeleteRequest: { Key: key } };
                });

                if (deleteRequests.length > 0) {
                    const batchWriteParams = { RequestItems: { [tableName]: deleteRequests } };
                    await dynamoDBClient.send(new BatchWriteCommand(batchWriteParams));
                    totalDeletedItems += deleteRequests.length;
                    console.log(`Deleted ${deleteRequests.length} items from ${tableName}`);
                }
            }

            lastEvaluatedKey = scanResult.LastEvaluatedKey;
        } while (lastEvaluatedKey);

        return totalDeletedItems;
    } catch (error) {
        console.error(`Error clearing table ${tableName}:`, error);
        throw error;
    }
};

const clearS3Bucket = async () => {
    try {
        const listParams = { Bucket: bucketName };
        let totalDeletedItems = 0;
        let continuationToken = undefined;

        do {
            const listedObjects: ListObjectsV2CommandOutput = await s3.send(new ListObjectsV2Command({ ...listParams, ContinuationToken: continuationToken }));

            if (listedObjects.Contents && listedObjects.Contents.length > 0) {
                const deleteParams = {
                    Bucket: bucketName,
                    Delete: {
                        Objects: listedObjects.Contents.map(({ Key }) => ({ Key })),
                    },
                };
                await s3.deleteObjects(deleteParams);
                totalDeletedItems += listedObjects.Contents.length;
                console.log(`Deleted ${listedObjects.Contents.length} objects from S3 bucket ${bucketName}`);
            }

            continuationToken = listedObjects.IsTruncated ? listedObjects.NextContinuationToken : undefined;
        } while (continuationToken);

        console.log(`Total deleted items from S3 bucket ${bucketName}: ${totalDeletedItems}`);
        return totalDeletedItems;
    } catch (error) {
        console.error(`Error clearing S3 bucket ${bucketName}:`, error);
        throw error;
    }
};


export const handler = async () => {
    try {
        // const authToken = event.headers['X-Authorization'];

        // Validate the authorization token
        // if (!validateAuthToken(authToken)) {
        //     return {
        //         statusCode: 403,
        //         body: JSON.stringify({
        //             message: 'Authentication failed due to invalid or missing AuthenticationToken.'
        //         })
        //     };
        // }

        // Clear S3 bucket
        const s3DeletedCount = await clearS3Bucket();

        // Clear DynamoDB tables
        const results = await Promise.all([
            clearTable('PackageMetaData'),
            clearTable('PackageHistory')
        ]);

        return {
            statusCode: 200,
            body: JSON.stringify({
                message: 'Registry is reset.',
                details: {
                    S3: `Deleted ${s3DeletedCount} items`,
                    PackageMetaData: `Deleted ${results[0]} items`,
                    PackageHistory: `Deleted ${results[1]} items`
                }
            })
        };
    } catch (error) {
        console.error('Error in handler:', error);
        return {
            statusCode: 500,
            body: JSON.stringify({
                message: 'Failed to clear resources.',
                error: (error as Error).message,
                details: (error as Error) .stack
            })
        };
    }
};

// Mock function to validate X-Authorization token
// const validateAuthToken = (authToken) => {
//     // Replace with actual validation logic or call to an authentication service
//     if (!authToken || authToken !== 'valid-admin-token') {
//         return false;
//     }
//     return true;
// };
