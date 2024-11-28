import aws4 from "aws4";
import axios from "axios";
import { defaultProvider } from "@aws-sdk/credential-provider-node";

const commonPath = process.env.COMMON_PATH || '/opt/nodejs/common';
const interfaces = require(`${commonPath}/interfaces`);
type PackageMetadata = typeof interfaces.PackageMetadata;

export async function uploadReadme(
    domainEndpoint: string,
    indexName: string,
    readmeContent: string,
    metadata: PackageMetadata
) {
    try {
        // Get AWS credentials
        const credentials = await defaultProvider()();

        // Prepare the OpenSearch request
        const request = {
            host: domainEndpoint.replace(/^https?:\/\//, ''), // Extract the hostname
            method: 'PUT',
            path: `/${indexName}/_doc/${metadata.ID}`, // Document path in OpenSearch
            service: 'es', // AWS service name for OpenSearch
            body: JSON.stringify({
                content: readmeContent,
                metadata: metadata,
                timestamp: new Date().toISOString(),
            }),
            headers: {
                'Content-Type': 'application/json',
            },
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

        console.log('Document indexed:', response.data);

    } catch (error) {
        // Error handling
        const err = error as any;
        console.error(
            'Error indexing document:',
            err.response?.data || err.message
        );
    }
}

export async function clearDomain(domainEndpoint: string) {
    const credentials = await defaultProvider()();
    const request = {
        host: domainEndpoint.replace(/^https?:\/\//, ""),
        path: "/_all",
        service: "es",
        method: "DELETE",
        headers: {
            "Content-Type": "application/json",
        },
    };

    aws4.sign(request, credentials);

    console.log("Deleting all indices from domain:", domainEndpoint);
    try {
        const response = await axios({
            method: request.method,
            url: `https://${request.host}${request.path}`,
            headers: request.headers,
        });
        // await createReadmeIndex(domainEndpoint);
        console.log("All indices deleted:", response.data);
    } catch (error) {
        console.error("Error deleting indices:", error);

    }
}