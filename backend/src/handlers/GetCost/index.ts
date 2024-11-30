import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";

const commonPath = process.env.COMMON_PATH || '/opt/nodejs/common';
const { createErrorResponse } = require(`${commonPath}/utils`);
const { getPackageById } = require(`${commonPath}/dynamodb`);
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const interfaces = require(`${commonPath}/interfaces`);
type PackageCost = typeof interfaces.PackageCost;
type PackageTableRow = typeof interfaces.PackageTableRow;

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
    try {
        const dynamoDBClient = DynamoDBDocumentClient.from(new DynamoDBClient());

        // Validate package ID from path parameters
        const packageId = event.pathParameters?.id;
        if (!packageId) {
            return createErrorResponse(400, "There is missing field(s) in the PackageID");
        }

        // Retrieve the dependency query parameter
        const includeDependencies = event.queryStringParameters?.dependency === 'true';

        // Fetch the package data from DynamoDB
        const packageRow: PackageTableRow | null = await getPackageById(dynamoDBClient, packageId);
        if (!packageRow) {
            return createErrorResponse(404, "Package does not exist.");
        }

        const response: PackageCost = {};

        // If we need to include dependencies, add the standalone cost and total cost
        if (includeDependencies) {
            response[packageId] = {
                standaloneCost: packageRow.standaloneCost,
                totalCost: packageRow.totalCost,
            };
        } else {  // Otherwise, only add the standalone cost
            response[packageId] = {
                totalCost: packageRow.standaloneCost,
            };
        }

        // TODO: Return a list containing the standalone cost and total cost of the package and its dependencies
        // The list should have one entry per dependency, with the standalone cost and total cost of each dependency
        // Success response
        return {
            statusCode: 200,
            body: JSON.stringify(response),
            headers: {
                'Content-Type': 'application/json',
            },
        };
    } catch (error) {
        console.error("Error:", error);
        return createErrorResponse(500, "The package rating system choked on at least one of the metrics.");
    }
};
