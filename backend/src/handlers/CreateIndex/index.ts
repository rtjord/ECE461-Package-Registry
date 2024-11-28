import axios from "axios";
import aws4 from "aws4";
import { defaultProvider } from "@aws-sdk/credential-provider-node";

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
    const domainEndpoint =
      "https://search-package-readmes-wnvohkp2wydo2ymgjsxmmslu6u.us-east-2.es.amazonaws.com";

    await createReadmeIndex(domainEndpoint);

    return {
      statusCode: 200,
      body: JSON.stringify("Index created successfully"),
    };
  } catch (error) {
    const err = error as Error;
    console.error(`Error creating index: ${err.message}`);
    return {
      statusCode: 500,
      body: JSON.stringify("Error creating index"),
    };
  }
};

async function createReadmeIndex(domainEndpoint: string) {
  const indexName = "readmes";
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

  try {
    // Get AWS credentials
    const credentials = await defaultProvider()();

    // Check if the index exists
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

    try {
      const response = await axios({
        method: checkRequest.method,
        url: `https://${checkRequest.host}${checkRequest.path}`,
        headers: checkRequest.headers,
      });

      if (response.status === 200) {
        console.log(`Index '${indexName}' already exists. Skipping creation.`);
        return;
      }
    } catch (error) {
      if (axios.isAxiosError(error) && error.response?.status === 404) {
        console.log(`Index '${indexName}' does not exist. Proceeding to create.`);
      } else {
        console.error("Error checking index existence:", error);
        throw new Error(`Error checking index existence: ${error}`);
      }
    }

    // Create the index
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
