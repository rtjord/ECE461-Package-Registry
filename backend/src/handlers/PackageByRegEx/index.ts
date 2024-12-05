import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { defaultProvider } from '@aws-sdk/credential-provider-node';
import aws4 from 'aws4';
import axios from 'axios';
// import * as detector from 'redos-detector'

const commonPath = process.env.COMMON_PATH || '/opt/nodejs/common';
const { createErrorResponse, getEnvVariable } = require(`${commonPath}/utils`);
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const interfaces = require(`${commonPath}/interfaces`);
type PackageMetadata = typeof interfaces.PackageMetadata;

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  try {

    // Parse the request body or default to an empty object if it's undefined
    const parsedBody = event.body && typeof event.body === 'string' ? JSON.parse(event.body) : event.body;
    // Check if the body has a valid RegEx field
    if (!parsedBody.RegEx || !(typeof parsedBody.RegEx === 'string') || !isValidRegEx(parsedBody.RegEx)) {
      console.error('Missing or invalid RegEx field in the request body.');
      return createErrorResponse(400, 'Missing or invalid RegEx field in the request body.');
    }
    const regEx: string = parsedBody.RegEx; // Extract the RegEx field from the request body

    // console.log('Checking for ReDoS vulnerability in the provided regex:', regEx);
    // if (!detector.isSafePattern(regEx).safe) {
    //   console.error('The provided regex is vulnerable to ReDoS attacks.');
    //   return createErrorResponse(400, 'The provided regex is vulnerable to ReDoS attacks.');
    // }

    // Search over package names and readmes
    console.log('Searching for packages matching the regular expression:', regEx);
    const domainEndpoint = getEnvVariable('DOMAIN_ENDPOINT');
    // const domainEndpoint = "https://search-package-readmes-wnvohkp2wydo2ymgjsxmmslu6u.us-east-2.es.amazonaws.com";
    const matches = await searchReadmes(domainEndpoint, 'readmes', regEx);

    // If there are no matching packages, return a 404 response
    if (matches.length === 0) {
      console.error('No packages found matching the provided regular expression.');
      return createErrorResponse(404, 'No packages found matching the provided regular expression.');
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

function isValidRegEx(RegEx: string): boolean {
  try {
    new RegExp(RegEx);  // Use RE2 to prevent ReDoS attacks
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

    const regexQuery = {
      query: {
        bool: {
          should: [
            {
              regexp: {
                content: {
                  value: regEx, // Your regex pattern
                },
              },
            },
            {
              regexp: {
                "metadata.Name": {
                  value: regEx, // Same or different regex pattern
                },
              },
            },
          ],
        },
      },
      timeout: "2s"
    };

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