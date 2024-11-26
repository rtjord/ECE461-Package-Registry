import { DynamoDB } from '@aws-sdk/client-dynamodb';
import { unmarshall } from '@aws-sdk/util-dynamodb';
const interfacesPath = process.env.INTERFACES_PATH || '/common/interfaces';
// eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-unused-vars
const interfaces = require(interfacesPath);
type PackageMetadata = typeof interfaces.PackageMetadata;
import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';

const utilsPath = process.env.UTILS_PATH || '/common/utils';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { createErrorResponse } = require(utilsPath);

// Define the Lambda handler function that processes incoming API Gateway requests
export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  try {
    // Create a new instance of the DynamoDB client to interact with the database
    const dynamoDb = new DynamoDB({});

    // Parse the request body or default to an empty object if it's undefined
    const parsedBody = event.body && typeof event.body === 'string' ? JSON.parse(event.body) : event.body;
    // Check if the body has a valid RegEx field
    if (!parsedBody.RegEx || !(typeof parsedBody.RegEx === 'string') || !isValidRegEx(parsedBody.RegEx)) {
      return createErrorResponse(400, 'Missing or invalid RegEx field in the request body.');
    }

    const RegEx = parsedBody.RegEx; // Extract the RegEx field from the request body
    console.log(`Searching for packages matching the regular expression: ${RegEx}`);

    const params = {
      TableName: 'PackageMetadata',
      ProjectionExpression: 'PackageName, Version, ID', // Retrieve these attributes
    };

    const result = await dynamoDb.scan(params);  // Scan the DynamoDB table to retrieve all items
    console.log(result);
    const packages = result.Items ? result.Items.map(item => unmarshall(item)) : [];  // Unmarshall the DynamoDB items to JavaScript objects
    console.log(packages);
    // Filter the packages based on the provided regular expression to find matching package names
    const matchingPackages = packages.filter((pkg) => new RegExp(RegEx, 'i').test(pkg.PackageName));
    console.log(matchingPackages);
    const packageMetadataList: PackageMetadata[] = matchingPackages.map((pkg) => ({ Name: pkg.PackageName, Version: pkg.Version, ID: pkg.ID }));

    // If there are no matching packages, return a 404 response
    if (matchingPackages.length === 0) {
      return createErrorResponse(404, 'No packages found matching the provided regular expression.');
    }

    // Return a 200 response with the list of matching packages
    return {
      statusCode: 200,
      body: JSON.stringify(packageMetadataList),
    };
  } catch (error) {
    console.log('Error', error);
    return createErrorResponse(500, 'An error occurred while processing the request.');
  }
};

function isValidRegEx(RegEx: string): boolean {
  try {
    new RegExp(RegEx);
    return true;
  } catch {
    return false;
  }
}
