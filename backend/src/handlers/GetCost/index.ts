import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';

const utilsPath = process.env.UTILS_PATH || '/common/utils';
// eslint-disable-next-line @typescript-eslint/no-import-requires
const { getPackageById, createErrorResponse } = require(utilsPath);

const interfacesPath = process.env.INTERFACES_PATH || '/common/interfaces';
// eslint-disable-next-line @typescript-eslint/no-import-requires, @typescript-eslint/no-unused-vars
const interfaces = require(interfacesPath);

type PackageCost = typeof interfaces.PackageCost;
type PackageTableRow = typeof interfaces.PackageTableRow;

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

        // Retrieve the dependency query parameter
        const includeDependencies = event.queryStringParameters?.dependency === 'true';

        // Fetch the package data from DynamoDB
        const packageData: PackageTableRow | null = await getPackageById(dynamoDBClient, packageId);
        if (!packageData) {
            return createErrorResponse(404, "Package does not exist.");
        }

        const response: PackageCost = {};

        // If we need to include dependencies, add the standalone cost and total cost
        if (includeDependencies) {
            response[packageId] = {
                standaloneCost: packageData.standaloneCost,
                totalCost: packageData.standaloneCost,
            };
        } else {  // Otherwise, only add the standalone cost
            response[packageId] = {
                totalCost: packageData.standaloneCost,
            };
        }

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
