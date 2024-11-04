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
            return {
                statusCode: 400,
                body: JSON.stringify({ message: "There is missing field(s) in the PackageID" })
            };
        }

        // Split the id to extract packageName and version
        const [packageName, version] = packageId.split(':');

        // Retrieve the dependency query parameter
        const includeDependencies = event.queryStringParameters?.dependency === 'true';

        const dynamoDBParams = {
            TableName: 'PackageMetaData',
            Key: {
                packageName: packageName,
                version: version,
            },
        };

        const packageData = await dynamoDBClient.send(new GetCommand(dynamoDBParams));

        // Check if the package ID exists in the database
        if (!packageData.Item) {
            return {
                statusCode: 404,
                body: JSON.stringify({ message: "Package does not exist." })
            };
        }

        // Construct the response based on whether dependencies should be included
        const response: PackageCostResponse = {};
        const packageItem = packageData.Item as { standaloneCost: number; dependenciesCost?: number };
        if (includeDependencies && packageItem.dependenciesCost !== undefined) {
            response[packageId] = {
                standaloneCost: packageItem.standaloneCost,
                totalCost: packageItem.standaloneCost + packageItem.dependenciesCost
            };
        } else {
            response[packageId] = {
                totalCost: packageItem.standaloneCost
            };
        }

        // Success response
        return {
            statusCode: 200,
            body: JSON.stringify(response),
            headers: {
                'Content-Type': 'application/json'
            }
        };

    } catch (error) {
        console.error("Error:", error);
        return {
            statusCode: 500,
            body: JSON.stringify({ message: "The package rating system choked on at least one of the metrics." })
        };
    }
};
