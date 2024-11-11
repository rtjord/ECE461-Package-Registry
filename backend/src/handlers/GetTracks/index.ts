import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { createErrorResponse } from './utils';

export const handler = async (_event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  try {
    const plannedTracks: string[] = ["ML inside track"];
    return {
      statusCode: 200,
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ plannedTracks })
    };
  } catch (error: unknown) {
    return createErrorResponse(500, "The system encountered an error while retrieving the student's track information.");
  }
};

module.exports = { handler };