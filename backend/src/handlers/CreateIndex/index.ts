import https from "https";
import { Context } from 'aws-lambda';

const commonPath = process.env.COMMON_PATH || '/opt/nodejs/common';
const { checkIndexExists, deleteIndex, createIndex } = require(`${commonPath}/opensearch`);

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

    const tokenizedMapping = {
      settings: {
        "index.knn": true
      },
      mappings: {
        properties: {
          content: {
            type: "text", // Treat content as a single string
          },
          timestamp: {
            type: "date", // ISO-8601 date format
          },
          // embedding: {
          //   type: "knn_vector", // K-Nearest Neighbors vector for similarity search
          //   dimension: 1536, // Dimensions of the embedding vector
          //   method: {
          //     engine: "lucene",
          //     space_type: "l2",
          //     name: "hnsw",
          //     parameters: {}
          //   }
          // },
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
    const nonTokenizedMapping = {
      mappings: {
        properties: {
          content: {
            type: "text",
            index_options: "offsets",
            analyzer: "keyword", // Use the keyword analyzer to avoid tokenization
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

    if (await checkIndexExists("readmes")) {
      await deleteIndex("readmes");
    }

    if (await checkIndexExists("packagejsons")) {
      await deleteIndex("packagejsons");
    }

    if (await checkIndexExists("recommend")) {
      await deleteIndex("recommend");
    }

    createIndex("readmes", nonTokenizedMapping);
    createIndex("packagejsons", nonTokenizedMapping);
    createIndex("recommend", tokenizedMapping);
    console.log("CreateIndex handler completed successfully");

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
  console.log("Create index operation complete.");
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