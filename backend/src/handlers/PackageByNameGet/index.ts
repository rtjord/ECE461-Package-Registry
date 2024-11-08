import { DynamoDBClient } from '@aws-sdk/client-dynamodb'; // Ensure this line is present
import { DynamoDBDocumentClient, GetCommand } from '@aws-sdk/lib-dynamodb';

// Initialize DynamoDB client
const dynamoDBClient = DynamoDBDocumentClient.from(new DynamoDBClient());

export const handler = async (event:any) => {
    try {
        const {name} = event.pathParameters;

        if (!name) {
            return {
                statusCode: 400,
                headers: { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json' },
                body: JSON.stringify({ message: `Package name is ${name}.` }),
            };
        }

        const getParams = {
            TableName: 'PackageHistory',
            Key: {
                PackageName: name,
            },
        };

        const result = await dynamoDBClient.send(new GetCommand(getParams));

        if (!result.Item || !result.Item.history) {
            return {
                statusCode: 404,
                headers: { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json' },
                body: JSON.stringify({ message: `No history found for package: ${name}` }),
            };
        }

        return {
            statusCode: 200,
            headers: { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json' },
            body: JSON.stringify(result.Item.history),
        };
    } catch (error) {
        console.error('Error fetching package history:', error);

        return {
            statusCode: 500,
            headers: { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json' },
            body: JSON.stringify({ message: 'Failed to fetch package history.', error: (error as Error).message }),
        };
    }
};
