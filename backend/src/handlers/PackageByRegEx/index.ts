// import { DynamoDB } from '@aws-sdk/client-dynamodb';
// import { unmarshall } from '@aws-sdk/util-dynamodb';

const interfacesPath = process.env.INTERFACES_PATH || '/opt/nodejs/common/interfaces';
// eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-unused-vars
const interfaces = require(interfacesPath);
type PackageMetadata = typeof interfaces.PackageMetadata;
import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import aws4 from 'aws4';
import { defaultProvider } from '@aws-sdk/credential-provider-node';
import axios from 'axios';

const utilsPath = process.env.UTILS_PATH || '/opt/nodejs/common/utils';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { createErrorResponse } = require(utilsPath);

// Define the Lambda handler function that processes incoming API Gateway requests
export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  try {
    // Create a new instance of the DynamoDB client to interact with the database
    // const dynamoDb = new DynamoDB({});

    // Parse the request body or default to an empty object if it's undefined
    const parsedBody = event.body && typeof event.body === 'string' ? JSON.parse(event.body) : event.body;
    // Check if the body has a valid RegEx field
    if (!parsedBody.RegEx || !(typeof parsedBody.RegEx === 'string') || !isValidRegEx(parsedBody.RegEx)) {
      return createErrorResponse(400, 'Missing or invalid RegEx field in the request body.');
    }

    const RegEx = parsedBody.RegEx; // Extract the RegEx field from the request body

    // const params = {
    //   TableName: 'PackageMetadata',
    //   ProjectionExpression: 'PackageName, Version, ID', // Retrieve these attributes
    // };

    // const result = await dynamoDb.scan(params);  // Scan the DynamoDB table to retrieve all items
    // const packages = result.Items ? result.Items.map(item => unmarshall(item)) : [];  // Unmarshall the DynamoDB items to JavaScript objects
    // // Filter the packages based on the provided regular expression to find matching package names
    // const matchingPackages = packages.filter((pkg) => new RegExp(RegEx, 'i').test(pkg.PackageName));
    // const packageMetadataList: PackageMetadata[] = matchingPackages.map((pkg) => ({ Name: pkg.PackageName, Version: pkg.Version, ID: pkg.ID }));
    const matches = await searchReadmes('https://search-package-readmes-wnvohkp2wydo2ymgjsxmmslu6u.us-east-2.es.amazonaws.com', 'readmes', RegEx);
    console.log('Readme Matches:', matches);

    // If there are no matching packages, return a 404 response
    if (matches.length === 0) {
      return createErrorResponse(404, 'No packages found matching the provided regular expression.');
    }

    // Return a 200 response with the list of matching packages
    return {
      statusCode: 200,
      body: JSON.stringify(matches),
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

async function searchReadmes(
  domainEndpoint: string,
  indexName: string,
  regEx: string
): Promise<PackageMetadata[]> {
  try {
    // Get AWS credentials
    const credentials = await defaultProvider()();

    const regexQuery =
    {
      "query": {
        "regexp": {
          "content": {
            "value": regEx,
          }
        }
      }
    }

    // Prepare the OpenSearch request
    const request = {
      host: domainEndpoint.replace(/^https?:\/\//, ""),
      path: `/${indexName}/_search`,
      service: "es",
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(regexQuery)
    };

    console.log('Request:', request);

    // Sign the request using aws4
    aws4.sign(request, credentials);

    // Send the request using axios
    const response = await axios({
      method: request.method,
      url: `https://${request.host}${request.path}`, // Construct full URL
      headers: request.headers,
      data: request.body, // Attach request body
    });
    const packages: string[] = [];

    console.log('Response:', JSON.stringify(response.data.hits));
    response.data.hits.hits.forEach((hit: { _source: PackageMetadata }) => {
      packages.push(hit._source.metadata);
    });
    return packages;
  } catch (error) {
    // Error handling
    console.log(
      'Error searching through READMEs:',
      error
    );
    return [];
  }
}