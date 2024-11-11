import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, GetCommand } from '@aws-sdk/lib-dynamodb';
import { PackageTableRow } from "./interfaces";
import { APIGatewayProxyResult } from "aws-lambda";

const dynamoDBClient = DynamoDBDocumentClient.from(new DynamoDBClient());

export async function getPackageById(packageId: string) {
    const params = {
        TableName: "PackageTable",         // Your table name
        Key: {
            ID: packageId                  // Primary key attribute
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

// Function to create a consistent error response
export const createErrorResponse = (statusCode: number, message: string): APIGatewayProxyResult => {
    return {
        statusCode,
        headers: { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json' },
        body: JSON.stringify({ message }),
    };
};