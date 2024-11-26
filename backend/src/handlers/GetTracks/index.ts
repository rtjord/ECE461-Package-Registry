import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
const path = process.env.UTILS_PATH || 'common/utils';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { createErrorResponse } = require(`${path}`);

// eslint-disable-next-line @typescript-eslint/no-unused-vars
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
  } catch {
    return createErrorResponse(500, "The system encountered an error while retrieving the student's track information.");
  }
};

module.exports = { handler };
