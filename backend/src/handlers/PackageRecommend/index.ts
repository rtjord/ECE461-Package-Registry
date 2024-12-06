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
        // Check if the body has a valid Description field
        if (!parsedBody.Description || !(typeof parsedBody.Description === 'string')) {
            console.error('Missing or invalid Description field in the request body.');
            return createErrorResponse(400, 'Missing or invalid RegEx field in the request body.');
        }
        const description: string = parsedBody.Description; // Extract the Description field from the request body

        // Search over package names and readmes
        console.log('Searching for packages matching the description:', description);
        const domainEndpoint: string = getEnvVariable('DOMAIN_ENDPOINT');
        const matches = await recommendPackages(domainEndpoint, 'recommend', description);
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


async function recommendPackages(
    domainEndpoint: string,
    indexName: string,
    description: string
): Promise<PackageMetadata[]> {
    try {
        // Get AWS credentials
        const credentials = await defaultProvider()();

        const recommendationQuery = {
            "query": {
                "multi_match": {
                    "query": description,
                    "fields": ["content"]
                }
            },
            "size": 5
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
            body: JSON.stringify(recommendationQuery),
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
        const packages: PackageMetadata[] = [];

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