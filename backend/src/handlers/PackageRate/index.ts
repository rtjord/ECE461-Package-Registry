import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { getPackageById, createErrorResponse } from './utils';
import { PackageTableRow, PackageRating } from './interfaces';
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
    try {
        const dynamoDBClient = DynamoDBDocumentClient.from(new DynamoDBClient());

        // Validate package ID from path parameters
        const packageId = event.pathParameters?.id;
        if (!packageId) {
            return createErrorResponse(400, "There is missing field(s) in the PackageID");
        }

        // Fetch the package data from DynamoDB
        const packageData: PackageTableRow | null = await getPackageById(dynamoDBClient, packageId);
        if (!packageData) {
            return createErrorResponse(404, "Package does not exist.");
        }

        const rating: PackageRating = packageData.Rating;
        if (!rating) {
            return createErrorResponse(404, "Package rating does not exist.");
        }

        // Success response
        return {
            statusCode: 200,
            body: JSON.stringify(rating),
            headers: {
                'Content-Type': 'application/json',
            },
        };
    } catch (error) {
        console.error("Error:", error);
        return createErrorResponse(500, "The package rating system choked on at least one of the metrics.");
    }
};
