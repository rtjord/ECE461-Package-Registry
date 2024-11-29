import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";

const commonPath = process.env.COMMON_PATH || '/opt/nodejs/common';
const { createErrorResponse } = require(`${commonPath}/utils`);
const { getPackageById } = require(`${commonPath}/dynamodb`);
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const interfaces = require(`${commonPath}/interfaces`);
type PackageRating = typeof interfaces.PackageRating;
type PackageTableRow = typeof interfaces.PackageTableRow;

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
            return createErrorResponse(404, `Package does not exist.`);
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
