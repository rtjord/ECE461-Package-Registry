import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';

const commonPath = process.env.COMMON_PATH || '/opt/nodejs/common';
const { createErrorResponse } = require(`${commonPath}/utils`);
const { recommendPackages } = require(`${commonPath}/opensearch`);
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const interfaces = require(`${commonPath}/interfaces`);
type PackageMetadata = typeof interfaces.PackageMetadata;

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
    try {

        // Parse the request body or default to an empty object if it's undefined
        const parsedBody = event.body && typeof event.body === 'string' ? JSON.parse(event.body) : event.body;
        // Check if the body has a valid Description field
        if (!parsedBody.Description || !(typeof parsedBody.Description === 'string')) {
            console.error('Missing or invalid Description field in the request body.');
            return createErrorResponse(400, 'Missing or invalid Description field in the request body.');
        }
        const description: string = parsedBody.Description; // Extract the Description field from the request body

        // Search over package names and readmes
        console.log('Searching for packages matching the description:', description);
        const matches: PackageMetadata[] = await recommendPackages(description);
        console.log('Matching packages:', matches);

        // If there are no matching packages, return a 404 response
        if (matches.length === 0) {
            console.error('No packages found matching the description.');
            return createErrorResponse(404, 'No packages found matching the description.');
        }

        // Return a 200 response with the list of matching packages
        return {
            statusCode: 200,
            body: JSON.stringify(matches),
        };
    } catch (error) {
        console.error('Error', error);
        return createErrorResponse(500, 'An error occurred while processing the request.');
    }
};
