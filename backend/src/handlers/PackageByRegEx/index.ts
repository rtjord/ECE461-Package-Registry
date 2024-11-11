import { DynamoDB } from '@aws-sdk/client-dynamodb';
import { unmarshall } from '@aws-sdk/util-dynamodb';
import { PackageMetadata } from './interfaces';
import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { createErrorResponse } from './utils';

// Create a new instance of the DynamoDB client to interact with the database
const dynamoDb = new DynamoDB({});

// Define the Lambda handler function that processes incoming API Gateway requests
export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  try {

    // Parse the request body or default to an empty object if it's undefined
    const parsedBody = event.body && typeof event.body === 'string' ? JSON.parse(event.body) : event.body;
    // Check if the body has a valid RegEx field
    if (!parsedBody.RegEx) {
      return createErrorResponse(400, 'Missing or invalid RegEx field in the request body.');
    }

    const RegEx = parsedBody.RegEx; // Extract the RegEx field from the request body

    const params = {
        TableName: 'PackageMetadata',
        ProjectionExpression: 'PackageName, Version, ID', // Retrieve these attributes
    };
    
    const result = await dynamoDb.scan(params);  // Scan the DynamoDB table to retrieve all items
    console.log(result);
    const packages = result.Items ? result.Items.map(item => unmarshall(item)) : [];  // Unmarshall the DynamoDB items to JavaScript objects
    console.log(packages);
    // Filter the packages based on the provided regular expression to find matching package names
    const matchingPackages = packages.filter((pkg) => new RegExp(RegEx, 'i').test(pkg.Name));
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
