import { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import { GetCommand, QueryCommand, PutCommand } from '@aws-sdk/lib-dynamodb';
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

        // If no items are found, return an empty array
        return result.Items as PackageMetadata[] || [];
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

    return result.Items as PackageHistoryEntry[];
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