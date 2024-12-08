import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';

const commonPath = process.env.COMMON_PATH || '/opt/nodejs/common';
const { createErrorResponse } = require(`${commonPath}/utils`);
const { searchReadmes } = require(`${commonPath}/opensearch`);
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
    const matches: PackageMetadata[] = await searchReadmes(regEx);
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

/**
 * Checks if a given string is a valid regular expression.
 *
 * @param regexStr - The string to be tested as a regular expression.
 * @returns `true` if the string is a valid regular expression, `false` otherwise.
 */
function isValidRegEx(regexStr: string): boolean {
  try {
    new RegExp(regexStr);
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