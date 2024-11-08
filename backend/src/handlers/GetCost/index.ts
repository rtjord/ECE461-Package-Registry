import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand } from '@aws-sdk/lib-dynamodb';

const dynamoDBClient = DynamoDBDocumentClient.from(new DynamoDBClient());

// Define type for the PackageCost response structure
interface PackageCostResponse {
    [packageId: string]: {
        standaloneCost?: number;
        totalCost: number;
    };
}

// Lambda handler
export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
    try {
        // Validate package ID from path parameters
        const packageId = event.pathParameters?.id;
        if (!packageId) {
            return createErrorResponse(400, "There is missing field(s) in the PackageID");
        }

        // Split the id to extract packageName and version
        const [packageName, version] = packageId.split(':');
        if (!packageName || !version) {
            return createErrorResponse(404, "Package does not exist.");
        }

        // Retrieve the dependency query parameter
        const includeDependencies = event.queryStringParameters?.dependency === 'true';

        // Fetch the package data from DynamoDB
        const packageData = await fetchPackageData(packageName, version);
        if (!packageData) {
            return createErrorResponse(404, "Package does not exist.");
        }
        // Construct the response
        const response = constructResponse(packageId, packageData, includeDependencies);
        
        // Success response
        return createSuccessResponse(response);
    } catch (error) {
        console.error("Error:", error);
        return createErrorResponse(500, "The package rating system choked on at least one of the metrics.");
    }
};

// Function to create a consistent error response
const createErrorResponse = (statusCode: number, message: string): APIGatewayProxyResult => {
    return {
        statusCode,
        body: JSON.stringify({ message }),
    };
};

// Function to create a consistent success response
const createSuccessResponse = (response: PackageCostResponse): APIGatewayProxyResult => {
    return {
        statusCode: 200,
        body: JSON.stringify(response),
        headers: {
            'Content-Type': 'application/json',
        },
    };
};

// Function to fetch package data from DynamoDB
const fetchPackageData = async (packageName: string, version: string) => {
    const dynamoDBParams = {
        TableName: 'package-metadata',
        Key: {
            packageName: packageName,
            version: version,
        },
    };

    const result = await dynamoDBClient.send(new GetCommand(dynamoDBParams));
    return result.Item as { standaloneCost: number; dependenciesCost?: number } | undefined;
};

// Function to construct the response
const constructResponse = (packageId: string, packageItem: { standaloneCost: number; dependenciesCost?: number }, includeDependencies: boolean): PackageCostResponse => {
    const response: PackageCostResponse = {};
    if (includeDependencies && packageItem.dependenciesCost !== undefined) {
        response[packageId] = {
            standaloneCost: packageItem.standaloneCost,
            totalCost: packageItem.standaloneCost + packageItem.dependenciesCost,
        };
    } else {
        response[packageId] = {
            totalCost: packageItem.standaloneCost,
        };
    }
    return response;
};
