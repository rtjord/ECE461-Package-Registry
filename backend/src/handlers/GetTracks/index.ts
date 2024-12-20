import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
const path = process.env.COMMON_PATH || '/opt/nodejs/common';
const { createErrorResponse } = require(`${path}/utils`);

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export const handler = async (_event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  try {
    const plannedTracks: string[] = ["ML inside track"];
    console.log("Retrieved the student's track information.");
    return {
      statusCode: 200,
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ plannedTracks })
    };
  } catch {
    console.error("An error occurred while retrieving the student's track information.");
    return createErrorResponse(500, "The system encountered an error while retrieving the student's track information.");
  }
};

module.exports = { handler };
