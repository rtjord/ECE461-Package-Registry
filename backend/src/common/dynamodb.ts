/* eslint-disable @typescript-eslint/no-explicit-any */
import { DynamoDBDocumentClient, DeleteCommand } from "@aws-sdk/lib-dynamodb";
import { GetCommand, QueryCommand, PutCommand } from '@aws-sdk/lib-dynamodb';
import {
    DynamoDBClient,
    ScanCommand,
    BatchWriteItemCommand,
    ScanCommandOutput,
} from "@aws-sdk/client-dynamodb";
import { PackageID, PackageHistoryEntry, PackageMetadata, User, PackageTableRow } from "./interfaces";

export async function getPackageById(dynamoDBClient: DynamoDBDocumentClient, packageId: PackageID) {
    const params = {
        TableName: "PackageMetadata",
        Key: {
            ID: packageId
        }
    };

    const command = new GetCommand(params);
    const result = await dynamoDBClient.send(command);

    // Check if the item was found
    if (!result.Item) {
        return null;
    }
    return result.Item as PackageTableRow;
}

export async function getPackageByName(dynamoDBClient: DynamoDBDocumentClient, name: string): Promise<PackageMetadata[]> {
    const tableName = "PackageMetadata";
    const indexName = "PackageNameVersionIndex";

    try {
        const result = await dynamoDBClient.send(
            new QueryCommand({
                TableName: tableName,
                IndexName: indexName,
                KeyConditionExpression: "PackageName = :packageName",
                ExpressionAttributeValues: {
                    ":packageName": name,
                },
            })
        );

        const output = result.Items?.map(item => {
            const { PackageName, Version, ID } = item;
            return { Name: PackageName, Version: Version, ID: ID };
        }) as PackageMetadata[];
        // If no items are found, return an empty array
        return output || [];
    } catch (error) {
        console.error("Error querying the DynamoDB table:", error);
        throw new Error("Failed to retrieve packages.");
    }
}

export async function getPackageHistory(dynamoDBClient: DynamoDBDocumentClient, packageName: string): Promise<PackageHistoryEntry[]> {
    const params = {
        TableName: "PackageHistoryTable",
        KeyConditionExpression: "#pkgName = :nameVal",
        ExpressionAttributeNames: {
            "#pkgName": "PackageName",
        },
        ExpressionAttributeValues: {
            ":nameVal": packageName,
        },
    };

    // Must use query to get all items with the same partition key
    const command = new QueryCommand(params);
    const result = await dynamoDBClient.send(command);

    const output = result.Items?.map(item => {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { PackageName, ...rest } = item;
        return rest;
    }) as PackageHistoryEntry[];
    return output;
}

export async function updatePackageHistory(dynamoDBClient: DynamoDBDocumentClient, packageName: string, version: string, packageId: string, user: User, action: string) {
    const date = new Date().toISOString();
    const dynamoDBParams = {
        TableName: "PackageHistoryTable",
        Item: {
            PackageName: packageName,
            Date: date,
            User: user,
            PackageMetadata: {
                Name: packageName,
                Version: version,
                ID: packageId,
            },
            Action: action,
        }
    };
    await dynamoDBClient.send(new PutCommand(dynamoDBParams));
}


export async function uploadPackageMetadata(dynamoDBClient: DynamoDBDocumentClient, metadata: PackageTableRow) {
    const dynamoDBParams = {
        TableName: "PackageMetadata",
        Item: metadata,
    };
    await dynamoDBClient.send(new PutCommand(dynamoDBParams));
}

export async function deletePackageFromDynamoDB(client: DynamoDBDocumentClient, id: string): Promise<void> {
    try {
        const deleteParams = {
            TableName: 'PackageMetadata',
            Key: { ID: id },
        };
        await client.send(new DeleteCommand(deleteParams));
        console.log(`Successfully deleted metadata for package ID: ${id}`);
    } catch (error) {
        console.error(`Error deleting package metadata for ID: ${id}`, error);
        throw new Error("Failed to delete package metadata.");
    }
}

// Reusable function to delete items from DynamoDB in batches
export async function deleteDynamoDBItems(
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
export async function clearDynamoDBTable(
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