import { APIGatewayProxyHandler } from 'aws-lambda'; // Import the AWS Lambda handler type to define the structure of the Lambda function
import { DynamoDB } from '@aws-sdk/client-dynamodb'; // Import the DynamoDB client from AWS SDK to interact with DynamoDB
import { unmarshall } from '@aws-sdk/util-dynamodb'; // Import the unmarshall utility to convert DynamoDB items to JavaScript objects
import { PackageMetadata } from '../../interfaces'; // Import the PackageRegEx and PackageMetadata interfaces from the interfaces file

// Create a new instance of the DynamoDB client to interact with the database
const dynamoDb = new DynamoDB({});

// Define the Lambda handler function that processes incoming API Gateway requests
export const handler: APIGatewayProxyHandler = async (event) => {
  try {
    console.log('Received event:', event); // Log the incoming event for debugging purposes

    // Parse the request body or default to an empty object if it's undefined
    const parsedBody = event.body && typeof event.body === 'string' ? JSON.parse(event.body) : event.body;

    console.log('Parsed request body:', parsedBody); // Log the parsed request body for debugging purposes
    // Check if the body has a valid RegEx field
    if (!parsedBody.RegEx) {
        return {
            statusCode: 400,
            body: JSON.stringify({ message: 'Missing or invalid RegEx field in the request body.' }),
        };
    }

    const RegEx = parsedBody.RegEx; // Extract the RegEx field from the request body

    const params = {
        TableName: 'package-metadata',
        ProjectionExpression: 'Name, Version, PackageID', // Retrieve these attributes
    };
    
    console.log('Scanning the table for packages with the provided regular expression...'); // Log a message to indicate that the table is being scanned for packages
    const result = await dynamoDb.scan(params);
    const packages = result.Items ? result.Items.map(item => unmarshall(item)) : [];

    // Filter the packages based on the provided regular expression to find matching package names
    const matchingPackages = packages.filter((pkg) => new RegExp(RegEx, 'i').test(pkg.packageName));

    // Check if there are no matching packages; if none are found, return a 404 response
    if (matchingPackages.length === 0) {
      return {
        statusCode: 404,
        body: JSON.stringify({ message: 'No package found under this regex.' }),
      };
    }

    // Return a 200 response with the list of matching packages
    return {
      statusCode: 200,
      body: JSON.stringify(matchingPackages),
    };
  } catch (error) {
    console.error('Error processing request:', error); // Log any errors that occur during the request processing for debugging purposes
    // Return a 500 response if an unexpected error occurs during the request processing
    return {
      statusCode: 500,
      body: JSON.stringify({ message: 'An error occurred while processing the request.' }),
    };
  }
};
