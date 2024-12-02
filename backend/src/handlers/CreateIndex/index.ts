import axios from "axios";
import aws4 from "aws4";
import https from "https";
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
  ResponseURL: string;
  RequestType: string; // "Create", "Update", or "Delete"
  PhysicalResourceId?: string;
  StackId: string;
  RequestId: string;
  LogicalResourceId: string;
}

import { Context } from 'aws-lambda';

export const handler = async (event: LambdaEvent, context: Context) => {
  console.log("Received event:", JSON.stringify(event, null, 2));

  const response = {
    Status: "FAILED",
    Reason: "Unknown error occurred",
    PhysicalResourceId: event.PhysicalResourceId || context.logStreamName,
    StackId: event.StackId,
    RequestId: event.RequestId,
    LogicalResourceId: event.LogicalResourceId,
    Data: {},
  };

  try {
    const domainEndpoint = getEnvVariable("DOMAIN_ENDPOINT");
    const indexName = "readmes";

    const exists = await checkIndexExists(domainEndpoint, indexName);

    if (!exists) {
      await createIndex(domainEndpoint, indexName);
    } else {
      console.log(`Index '${indexName}' already exists. Skipping creation.`);
    }

    response.Status = "SUCCESS";
    response.Reason = "Index operation completed successfully";
  } catch (error) {
    console.error("Error during index operation:", error);
    response.Status = "FAILED";
    if (error instanceof Error) {
      response.Reason = error.message || "Error during index operation";
    } else {
      response.Reason = "Error during index operation";
    }
  }

  // Send response to CloudFormation
  await sendCloudFormationResponse(event.ResponseURL, response);
};

interface CloudFormationResponse {
  Status: string;
  Reason: string;
  PhysicalResourceId: string;
  StackId: string;
  RequestId: string;
  LogicalResourceId: string;
  Data: Record<string, string | number | boolean>;
}

async function sendCloudFormationResponse(responseUrl: string, response: CloudFormationResponse) {
  const responseBody = JSON.stringify(response);
  console.log("Sending CloudFormation response:", responseBody);

  const parsedUrl = new URL(responseUrl);

  return new Promise<void>((resolve, reject) => {
    const options = {
      hostname: parsedUrl.hostname,
      path: parsedUrl.pathname + parsedUrl.search,
      method: "PUT",
      headers: {
        "Content-Type": "",
        "Content-Length": Buffer.byteLength(responseBody),
      },
    };

    const request = https.request(options, (res) => {
      console.log(`CloudFormation response status: ${res.statusCode}`);
      resolve();
    });

    request.on("error", (err) => {
      console.error("Error sending CloudFormation response:", err);
      reject(err);
    });

    request.write(responseBody);
    request.end();
  });
}

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
