import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, GetCommand, PutCommand } from '@aws-sdk/lib-dynamodb';
import { PackageID, PackageTableRow, User, PackageHistoryEntry } from "./interfaces";
import { APIGatewayProxyResult } from "aws-lambda";

export async function getPackageById(dynamoDBClient: DynamoDBClient, packageId: PackageID) {
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

export async function savePackageMetadata(dynamoDBClient: DynamoDBClient, packageId: string, packageName: string, version: string, fileUrl: string | null, fileSizeInMB: number) {
    const dynamoDBParams = {
        TableName: "PackageMetadata",
        Item: {
            PackageName: packageName,
            Version: version,
            ID: packageId,
            URL: fileUrl,
            s3Key: `uploads/${packageName}-${version}.zip`,
            standaloneCost: fileSizeInMB,
        },
    };
    await dynamoDBClient.send(new PutCommand(dynamoDBParams));
}

export async function updatePackageHistory(dynamoDBClient: DynamoDBClient, packageName: string, version: string, packageId: string, user: User, action: string) {
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

// Function to create a consistent error response
export const createErrorResponse = (statusCode: number, message: string): APIGatewayProxyResult => {
    return {
        statusCode,
        headers: { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json' },
        body: JSON.stringify({ message }),
    };
};