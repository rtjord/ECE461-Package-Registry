import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, GetCommand, PutCommand, QueryCommand } from '@aws-sdk/lib-dynamodb';
import { PackageID, PackageTableRow, User, PackageMetadata } from "./interfaces";
import { APIGatewayProxyResult } from "aws-lambda";

const dynamoDBClient = DynamoDBDocumentClient.from(new DynamoDBClient());

export async function getPackageById(packageId: PackageID) {
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

export async function getPackageByName(name: string): Promise<PackageMetadata[]> {
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
  
export async function savePackageMetadata(metadata: PackageTableRow) {
    const dynamoDBParams = {
        TableName: "PackageMetadata",
        Item: metadata,
    };
    await dynamoDBClient.send(new PutCommand(dynamoDBParams));
}

export async function updatePackageHistory(packageName: string, version: string, packageId: string, user: User, action: string) {
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