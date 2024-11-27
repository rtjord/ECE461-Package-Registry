import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";

const utilsPath = process.env.UTILS_PATH || '/opt/nodejs/common/utils';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { createErrorResponse, getPackageById } = require(utilsPath);

const interfacesPath = process.env.INTERFACES_PATH || '/opt/nodejs/common/interfaces';
/* eslint-disable @typescript-eslint/no-require-imports, @typescript-eslint/no-unused-vars */
const interfaces = require(interfacesPath);
type PackageRating = typeof interfaces.PackageRating;
type PackageTableRow = typeof interfaces.PackageTableRow;

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
    try {
        const dynamoDBClient = DynamoDBDocumentClient.from(new DynamoDBClient());

        // Validate package ID from path parameters
        const packageId = event.pathParameters?.id;
        console.log("PackageID:", packageId);
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
