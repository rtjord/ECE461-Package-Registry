import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand, QueryCommand } from '@aws-sdk/lib-dynamodb';
import { PackageTableRow } from '../../interfaces';

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

        // Retrieve the dependency query parameter
        const includeDependencies = event.queryStringParameters?.dependency === 'true';

        // Fetch the package data from DynamoDB
        const packageData = await getPackageById(packageId);
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

async function getPackageById(packageId: string) {
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
