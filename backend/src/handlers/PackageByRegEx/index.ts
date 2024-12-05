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

    console.log('Checking for ReDoS vulnerability in the provided regex:', regEx);
    if (quantifierIsTooLarge(regEx)) {
      console.error('The provided regex has a quantifier that is too large.');
      return createErrorResponse(400, 'The provided regex has a quantifier that is too large.');
    }

    // Search over package names and readmes
    console.log('Searching for packages matching the regular expression:', regEx);
    const domainEndpoint = getEnvVariable('DOMAIN_ENDPOINT');
    const matches = await searchReadmes(domainEndpoint, 'readmes', regEx);
    console.log('Matching packages:', matches);

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

/**
 * Checks if a regex contains large quantifier ranges.
 * @param {string} regexStr - The regex pattern as a string.
 * @returns {boolean} - Returns true if the regex is unsafe, false otherwise.
 */
function quantifierIsTooLarge(regexStr: string): boolean {
  // Pattern to match quantifiers {min,max}
  const quantifierPattern = /\{(\d+),(\d+)\}/g;
  let match;

  // Iterate over all quantifiers in the regex
  while ((match = quantifierPattern.exec(regexStr)) !== null) {
    const min = parseInt(match[1], 10);
    const max = parseInt(match[2], 10);

    // Check if max exceeds the safe threshold
    if (max > 1000) {
      console.error(`Unsafe quantifier range detected: {${min},${max}}`);
      return true;
    }
  }

  return false; // Regex is safe
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