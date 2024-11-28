import axios from "axios";
import aws4 from "aws4";
import { defaultProvider } from "@aws-sdk/credential-provider-node";
const commonPath = process.env.COMMON_PATH || '/opt/nodejs/common';
const { getEnvVariable } = require(`${commonPath}/utils`);

interface EventResourceProperties {
  DomainEndpoint: string;
  IndexName: string;
  Mapping: string; // JSON string
}

interface LambdaEvent {
  ResourceProperties: EventResourceProperties;
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export const handler = async (_event: LambdaEvent) => {
  try {
    // Extract required details from the event
    const domainEndpoint = getEnvVariable("DOMAIN_ENDPOINT");
    const indexName = "readmes";
    const exists = await checkIndexExists(domainEndpoint, indexName);

    if (!exists) {
      await createIndex(domainEndpoint, indexName);
    } else {
      console.log(`Index '${indexName}' already exists. Skipping creation.`);
    }

    return {
      statusCode: 200,
      body: JSON.stringify("Index operation completed successfully"),
    };
  } catch (error) {
    const err = error as Error;
    console.error(`Error during index operation: ${err.message}`);
    return {
      statusCode: 500,
      body: JSON.stringify("Error during index operation"),
    };
  }
};

// Function to check whether an index exists
async function checkIndexExists(domainEndpoint: string, indexName: string): Promise<boolean> {
  try {
    const credentials = await defaultProvider()();
    const checkRequest = {
      host: domainEndpoint.replace(/^https?:\/\//, ""),
      path: `/${indexName}`,
      service: "es",
      method: "HEAD",
      headers: {
        "Content-Type": "application/json",
      },
    };

    aws4.sign(checkRequest, credentials);

    const response = await axios({
      method: checkRequest.method,
      url: `https://${checkRequest.host}${checkRequest.path}`,
      headers: checkRequest.headers,
    });

    return response.status === 200;
  } catch (error) {
    if (axios.isAxiosError(error) && error.response?.status === 404) {
      console.log(`Index '${indexName}' does not exist.`);
      return false;
    } else {
      console.error("Error checking index existence:", error);
      throw new Error(`Error checking index existence: ${error}`);
    }
  }
}

// Function to create an index
async function createIndex(domainEndpoint: string, indexName: string) {
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
