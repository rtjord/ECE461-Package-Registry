import aws4 from "aws4";
import axios from "axios";
import { PackageMetadata } from "./interfaces";
import { STS } from "aws-sdk";
import { getEnvVariable, getSecret } from "./utils";
import OpenAI from 'openai';
import { SecretsManagerClient } from "@aws-sdk/client-secrets-manager";

/**
 * Assumes an AWS IAM role and returns temporary security credentials.
 *
 * @param roleArn - The Amazon Resource Name (ARN) of the role to assume.
 * @returns A promise that resolves to an object containing the access key ID, secret access key, and session token.
 * @throws An error if the role assumption fails.
 */
const assumeRole = async (roleArn: string): Promise<{
  accessKeyId: string;
  secretAccessKey: string;
  sessionToken: string;
}> => {
  const sts = new STS();
  const params = {
    RoleArn: roleArn,
    RoleSessionName: "OpenSearchSession",
  };

  const response = await sts.assumeRole(params).promise();
  if (!response.Credentials) {
    throw new Error("Failed to assume OpenSearchAdminRole.");
  }

  return {
    accessKeyId: response.Credentials.AccessKeyId!,
    secretAccessKey: response.Credentials.SecretAccessKey!,
    sessionToken: response.Credentials.SessionToken!,
  };
};


/**
 * Signs an AWS request using temporary credentials obtained by assuming a specified IAM role.
 *
 * @param {aws4.Request} request - The AWS request to be signed.
 * @param {string} roleArn - The Amazon Resource Name (ARN) of the IAM role to assume.
 * @returns {Promise<aws4.Request>} A promise that resolves to the signed AWS request.
 *
 * @example
 * ```typescript
 * const request: aws4.Request = {
 *   host: 'example.com',
 *   path: '/path',
 *   method: 'GET',
 *   headers: {}
 * };
 * const roleArn = 'arn:aws:iam::123456789012:role/example-role';
 * const signedRequest = await signRequest(request, roleArn);
 * ```
 */
export async function signRequest(request: aws4.Request, roleArn: string): Promise<aws4.Request> {
  console.log("Assuming role:", roleArn);
  const credentials = await assumeRole(roleArn);
  aws4.sign(request, {
    accessKeyId: credentials.accessKeyId,
    secretAccessKey: credentials.secretAccessKey,
    sessionToken: credentials.sessionToken,
  });
  return request;
}

/**
 * Makes an OpenSearch request by signing it with AWS credentials and sending it using Axios.
 *
 * @param {aws4.Request} request - The AWS4 request object to be signed and sent.
 * @returns {Promise<axios.AxiosResponse>} - A promise that resolves to the Axios response.
 *
 */
export async function makeOpenSearchRequest(request: aws4.Request): Promise<axios.AxiosResponse> {
  await signRequest(request, getEnvVariable("OPEN_SEARCH_ROLE"));
  const response = await axios({
    method: request.method,
    url: `https://${request.host}${request.path}`,
    headers: request.headers as Record<string, string>,
    data: request.body,
  });
  return response;
}

/**
 * Uploads a document to an OpenSearch index.
 *
 * @param indexName - The name of the OpenSearch index where the document will be uploaded.
 * @param content - The content of the document to be uploaded.
 * @param metadata - Metadata associated with the document.
 * @returns A promise that resolves to a boolean indicating whether the upload was successful.
 *
 */
export async function uploadToOpenSearch(
  indexName: string,
  content: string,
  metadata: PackageMetadata,
  includeEmbedding = false
) {
  try {
    const domainEndpoint = getEnvVariable("DOMAIN_ENDPOINT");

    let embedding: number[] = [];
    if (includeEmbedding) {
      embedding = await generateEmbedding(content);
      console.log('Embedding generated:', embedding);
    }
    // Prepare the OpenSearch request
    const request: aws4.Request = {
      host: domainEndpoint.replace(/^https?:\/\//, ''), // Extract the hostname
      method: 'PUT',
      path: `/${indexName}/_doc/${metadata.ID}`, // Document path in OpenSearch
      service: 'es', // AWS service name for OpenSearch
      body: JSON.stringify({
        content: content,
        metadata: metadata,
        timestamp: new Date().toISOString(),
        ...(includeEmbedding && { embedding: embedding }),
      }),
      headers: {
        'Content-Type': 'application/json',
      },
    };

    console.log('Uploading document to OpenSearch:', request.body);
    // Make the request to opensearch
    const response = await makeOpenSearchRequest(request);

    console.log('Document uploaded to OpenSearch:', response.data);

  } catch (error) {
    const err = error as Error;
    console.error('Error uploading to OpenSearch:', err.message);
    throw err;
  }
}

export async function retrieveFromOpenSearch(indexName: string, documentId: string): Promise<{ content: string; metadata: PackageMetadata; timestamp: string }> {
  try {
    const domainEndpoint = getEnvVariable("DOMAIN_ENDPOINT");

    // Prepare the OpenSearch request
    const request: aws4.Request = {
      host: domainEndpoint.replace(/^https?:\/\//, ''), // Extract the hostname
      method: 'GET',
      path: `/${indexName}/_doc/${encodeURIComponent(documentId)}`, // Document path in OpenSearch
      service: 'es', // AWS service name for OpenSearch
      headers: {
        'Content-Type': 'application/json',
      },
    };

    const response = await makeOpenSearchRequest(request);
    console.log('Document retrieved from OpenSearch:', response.data);

    // Extract the source document from the response
    const document = response.data._source;

    return document;
  } catch (error) {
    // Error handling
    const err = error as Error;
    console.error('Error retrieving from OpenSearch:', err.message);
    throw err;
  }
}

export async function deleteFromOpenSearch(indexName: string, documentId: string) {

  console.log(`Deleting document with ID '${documentId}' from index: '${indexName}'`);
  try {
    const domainEndpoint = getEnvVariable("DOMAIN_ENDPOINT");
    // Construct the delete document request
    const request = {
      host: domainEndpoint.replace(/^https?:\/\//, ""),
      path: `/${indexName}/_doc/${documentId}`, // Path to the specific document
      service: "es",
      method: "DELETE",
      headers: {
        "Content-Type": "application/json",
      },
    };

    const response = await makeOpenSearchRequest(request);
    console.log(`Document with ID '${documentId}' deleted from index '${indexName}':`, response.data);
  } catch (error) {
    console.error(`Error deleting document with ID '${documentId}' from index '${indexName}':`, error);
    throw new Error(`Failed to delete document with ID '${documentId}' from index '${indexName}'.`);
  }
}

export async function createIndex(indexName: string, mapping: unknown) {
  try {
    const domainEndpoint = getEnvVariable("DOMAIN_ENDPOINT");
    const request = {
      host: domainEndpoint.replace(/^https?:\/\//, ""),
      path: `/${indexName}`,
      service: "es",
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(mapping),
    };

    await makeOpenSearchRequest(request);

    console.log(`Index '${indexName}' created successfully.`);
  } catch (error) {
    if (axios.isAxiosError(error)) {
      console.error(`Error creating index: ${JSON.stringify(error.response?.data)}`);
    }
    throw new Error(`Error creating index: ${error}`);
  }
}


export async function clearIndex(indexName: string) {
  try {
    console.log(`Clearing all documents from index: ${indexName}`);
    const domainEndpoint = getEnvVariable("DOMAIN_ENDPOINT");

    // Construct the delete-by-query request
    const request: aws4.Request = {
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

    // Make the request to OpenSearch
    const response = await makeOpenSearchRequest(request);
    console.log(`All documents cleared from index '${indexName}':`, response.data);
  } catch (error) {
    console.error(`Error clearing index '${indexName}':`, error);
    throw new Error(`Error clearing index '${indexName}': ${error}`);
  }
}

export async function deleteIndex(indexName: string) {
  try {
    const domainEndpoint = getEnvVariable("DOMAIN_ENDPOINT");
    console.log(`Deleting index "${indexName}" from domain:`, domainEndpoint);

    const request = {
      host: domainEndpoint.replace(/^https?:\/\//, ""),
      path: `/${indexName}`,
      service: "es",
      method: "DELETE",
      headers: {
        "Content-Type": "application/json",
      },
    };

    const response = await makeOpenSearchRequest(request);

    console.log(`Index "${indexName}" deleted successfully:`, response.data);
  } catch (error) {
    console.error(`Error deleting index "${indexName}":`, error);
    throw new Error(`Error deleting index "${indexName}": ${error}`);
  }
}


export async function clearDomain() {
  try {
    const domainEndpoint = getEnvVariable("DOMAIN_ENDPOINT");
    console.log("Deleting all indices from domain:", domainEndpoint);
    const request = {
      host: domainEndpoint.replace(/^https?:\/\//, ""),
      path: "/_all",
      service: "es",
      method: "DELETE",
      headers: {
        "Content-Type": "application/json",
      },
    };

    const response = await makeOpenSearchRequest(request);

    console.log("All indices deleted:", response.data);
  } catch (error) {
    console.error("Error deleting indices:", error);
    throw new Error(`Error deleting indices: ${error}`);
  }
}

// Function to check whether an index exists
export async function checkIndexExists(indexName: string): Promise<boolean> {
  try {

    const domainEndpoint: string = getEnvVariable("DOMAIN_ENDPOINT");
    const request = {
      host: domainEndpoint.replace(/^https?:\/\//, ""),
      path: `/${indexName}`,
      service: "es",
      method: "HEAD",
      headers: {
        "Content-Type": "application/json",
      },
    };

    const response = await makeOpenSearchRequest(request);

    return response.status === 200;
  } catch (error) {
    if (axios.isAxiosError(error)) {
      console.log(`Index '${indexName}' does not exist.`);
      return false;
    } else {
      console.error("Error checking index existence:", error);
      throw new Error(`Error checking index existence: ${error}`);
    }
  }
}

export async function searchReadmes(
  regEx: string
): Promise<PackageMetadata[]> {
  try {

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

    const domainEndpoint: string = getEnvVariable("DOMAIN_ENDPOINT");
    // Prepare the OpenSearch request
    const request = {
      host: domainEndpoint.replace(/^https?:\/\//, ""),
      path: `/readmes/_search`,
      service: "es",
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(regexQuery)
    };

    const response = await makeOpenSearchRequest(request);
    const packages: PackageMetadata[] = [];

    response.data.hits.hits.forEach((hit: { _source: { metadata: PackageMetadata } }) => {
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

export async function recommendPackages(description: string): Promise<PackageMetadata[]> {
  try {

    console.log('Generating embedding for description:', description);
    const embedding = await generateEmbedding(description);
    console.log('Embedding of description:', embedding);
    // const recommendationQuery = {
    //   size: 5,
    //   query: {
    //     knn: {
    //       embedding: {
    //         vector: embedding,
    //         k: 5,
    //       },
    //     },
    //   },
    // };
    const recommendationQuery = {
      "query": {
        "match_all": {}
      },
    };

    // Prepare the OpenSearch request
    const domainEndpoint: string = getEnvVariable("DOMAIN_ENDPOINT");

    const request: aws4.Request = {
      host: domainEndpoint.replace(/^https?:\/\//, ""),
      path: `/recommend/_search`,
      service: "es",
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(recommendationQuery),
    };

    const response = await makeOpenSearchRequest(request);
    console.log('Recommendation response:', response.data);
    const packages: PackageMetadata[] = [];

    response.data.hits.hits.forEach((hit: { _source: { metadata: PackageMetadata } }) => {
      packages.push(hit._source.metadata);
    });
    return packages;
  } catch (error) {
    // Error handling
    if (axios.isAxiosError(error)) {
      console.error(`Error creating index: ${JSON.stringify(error.response?.data)}`);
    }
    return [];
  }
}

export async function generateEmbedding(text: string): Promise<number[]> {
  const secretsManagerClient = new SecretsManagerClient({
    region: "us-east-2",
  });
  const secret = await getSecret(secretsManagerClient, "OpenAI_API_Key");
  const client = new OpenAI({
    apiKey: secret, // Make sure to set your API key
  });

  const response = await client.embeddings.create({
    model: "text-embedding-ada-002",
    input: text,
  });
  return response.data[0].embedding;
}