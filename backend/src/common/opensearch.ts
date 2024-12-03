import aws4 from "aws4";
import axios from "axios";
import { defaultProvider } from "@aws-sdk/credential-provider-node";
import { PackageMetadata } from "./interfaces";

export async function uploadToOpenSearch(
    domainEndpoint: string,
    indexName: string,
    content: string,
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
                content: content,
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

        console.log('Document uploaded to OpenSearch:', response.data);

    } catch (error) {
        // Error handling
        const err = error as Error;
        console.error(
            'Error uploading to OpenSearch:',
            err.message
        );
    }
}

export async function retrieveFromOpenSearch(
  domainEndpoint: string,
  indexName: string,
  documentId: string
): Promise<{ content: string; metadata: PackageMetadata; timestamp: string }> {
  try {
    // Get AWS credentials
    const credentials = await defaultProvider()();

    // Prepare the OpenSearch request
    const request = {
      host: domainEndpoint.replace(/^https?:\/\//, ''), // Extract the hostname
      method: 'GET',
      path: `/${indexName}/_doc/${encodeURIComponent(documentId)}`, // Document path in OpenSearch
      service: 'es', // AWS service name for OpenSearch
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
    });

    // console.log('Document retrieved from OpenSearch:', response.data);

    // Extract the source document from the response
    const document = response.data._source;
    // console.log(document)

    return document;
  } catch (error) {
    // Error handling
    const err = error as Error;
    console.error('Error retrieving from OpenSearch:', err.message);
    throw err;
  }
}


// Function to create an index
export async function createIndex(domainEndpoint: string, indexName: string) {
    try {
      const mapping = {
        mappings: {
          properties: {
            content: {
              type: "keyword", // Treat README content as a single string
            },
            timestamp: {
              type: "date", // ISO-8601 date format
            },
            metadata: {
              properties: {
                Name: { type: "keyword" },
                Version: { type: "keyword" },
                ID: { type: "keyword" },
              },
            },
          },
        },
      };
      const credentials = await defaultProvider()();
      const createRequest = {
        host: domainEndpoint.replace(/^https?:\/\//, ""),
        path: `/${indexName}`,
        service: "es",
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(mapping),
      };
  
      aws4.sign(createRequest, credentials);
  
      await axios({
        method: createRequest.method,
        url: `https://${createRequest.host}${createRequest.path}`,
        headers: createRequest.headers,
        data: createRequest.body,
      });
  
      console.log(`Index '${indexName}' created successfully.`);
    } catch (error) {
      console.error("Error creating index:", error);
      throw new Error(`Error creating index: ${error}`);
    }
  }
  

export async function clearIndex(domainEndpoint: string, indexName: string) {
    const credentials = await defaultProvider()();

    // Construct the delete-by-query request
    const request = {
        host: domainEndpoint.replace(/^https?:\/\//, ""),
        path: `/${indexName}/_delete_by_query`,
        service: "es",
        method: "POST",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify({
            query: {
                match_all: {} // Match all documents for deletion
            }
        }),
    };

    aws4.sign(request, credentials);

    console.log(`Clearing all documents from index: ${indexName}`);
    try {
        const response = await axios({
            method: request.method,
            url: `https://${request.host}${request.path}`,
            headers: request.headers,
            data: request.body,
        });
        console.log(`All documents cleared from index '${indexName}':`, response.data);
    } catch (error) {
        console.error(`Error clearing index '${indexName}':`, error);
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