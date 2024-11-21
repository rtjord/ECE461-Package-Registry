import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export const handler = async (_event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
    const message = "This system does not support authentication.";
    return {
      statusCode: 501,
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ message })
    };
};

module.exports = { handler };