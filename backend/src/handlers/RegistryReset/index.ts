/* eslint-disable @typescript-eslint/no-explicit-any */
import { APIGatewayProxyHandler } from "aws-lambda";
import { S3Client } from "@aws-sdk/client-s3";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
const commonPath = process.env.COMMON_PATH || '/opt/nodejs/common';
const { getEnvVariable } = require(`${commonPath}/utils`);
const { clearDynamoDBTable } = require(`${commonPath}/dynamodb`);
const { emptyS3Bucket } = require(`${commonPath}/s3`);
const { checkIndexExists, deleteIndex, createIndex } = require(`${commonPath}/opensearch`);


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
            //     type: "knn_vector", // K-Nearest Neighbors vector for similarity search
            //     dimension: 1536, // Dimensions of the embedding vector
            //     method: {
            //         engine: "lucene",
            //         space_type: "l2",
            //         name: "hnsw",
            //         parameters: {}
            //     }
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

// Lambda handler
export const handler: APIGatewayProxyHandler = async () => {
    try {
        // Inject clients
        const dynamoDBClient = DynamoDBDocumentClient.from(new DynamoDBClient());
        const s3Client = new S3Client({
            region: 'us-east-2',
        });

        // Define table and bucket names
        const table1 = "PackageMetadata"; // Table with ID as primary key
        const table2 = "PackageHistoryTable"; // Table with partition and sort keys
        const bucket = getEnvVariable("S3_BUCKET_NAME");

        console.log("Clearing resources...");
        // Perform all operations concurrently
        await Promise.all([
            clearDynamoDBTable(dynamoDBClient, table1, (item: { ID: any; }) => ({ ID: item.ID })),
            clearDynamoDBTable(dynamoDBClient, table2, (item: { PackageName: any; Date: any; }) => ({
                PackageName: item.PackageName,
                Date: item.Date,
            })),
            emptyS3Bucket(s3Client, bucket),
        ]);

        // await clearDomain(getEnvVariable("DOMAIN_ENDPOINT"));
        if (await checkIndexExists("readmes")) {
            await deleteIndex("readmes");
        }

        if (await checkIndexExists("packagejsons")) {
            await deleteIndex("packagejsons");
        }

        if (await checkIndexExists("recommend")) {
            await deleteIndex("recommend");
        }

        await createIndex("readmes", nonTokenizedMapping);
        await createIndex("packagejsons", nonTokenizedMapping);
        await createIndex("recommend", tokenizedMapping);
        // await clearIndex("readmes");
        // await clearIndex("packagejsons");
        // await clearIndex("recommend");
        console.log("All resources cleared successfully.");

        return {
            statusCode: 200,
            body: JSON.stringify({ message: "Tables and bucket cleared successfully." }),
        };
    } catch (error) {
        console.error("Error clearing resources:", error);
        return {
            statusCode: 500,
            body: JSON.stringify({ message: "Failed to clear resources.", error: error }),
        };
    }
};