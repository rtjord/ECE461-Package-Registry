import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';

export const handler = async (_event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  try {
    // Assuming the data is retrieved from some service or database
    const plannedTracks: string[] = ["ML inside track"];

    // Return a successful response
    return {
      statusCode: 200,
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ plannedTracks })
    };
  } catch (error: unknown) {
    // Return an error response if something goes wrong
    return {
      statusCode: 500,
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        message: "The system encountered an error while retrieving the student's track information.",
        error: (error instanceof Error) ? error.message : 'Unknown error',
      })
    };
  }
};

module.exports = { handler };