import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, DeleteCommand } from '@aws-sdk/lib-dynamodb';
import { S3, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import axios from "axios";
import aws4 from "aws4";
import { defaultProvider } from "@aws-sdk/credential-provider-node";

const commonPath = process.env.COMMON_PATH || '/opt/nodejs/common';
const { createErrorResponse, getEnvVariable } = require(`${commonPath}/utils`);
const { getPackageById } = require(`${commonPath}/dynamodb`);
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const interfaces = require(`${commonPath}/interfaces`);
type PackageTableRow = typeof interfaces.PackageTableRow;

 
export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
    try {
        const dynamoDBClient = DynamoDBDocumentClient.from(new DynamoDBClient());
        const s3Client = new S3();

        const id = event.pathParameters?.id;
        if (!id) {
            return createErrorResponse(400, "Missing ID in path parameters.");
        }

        const existingPackage: PackageTableRow | null = await getPackageById(dynamoDBClient, id);
        if (!existingPackage) {
            return createErrorResponse(404, `Package with ID ${id} not found.`);
        }

        await deletePackageFromDynamoDB(dynamoDBClient, id);

        await deletePackageFromS3(s3Client, existingPackage.s3Key);

        await deleteDocumentById(getEnvVariable('DOMAIN_ENDPOINT'), 'readmes', id);

        return createSuccessResponse(existingPackage.PackageName, existingPackage.Version);
    } catch (error) {
        console.error("Error during DELETE operation:", error);
        return createErrorResponse(500, "Internal server error occurred while deleting the package.");
    }
};

// Delete package metadata from DynamoDB
async function deletePackageFromDynamoDB(client: DynamoDBDocumentClient, id: string): Promise<void> {
    try {
        const deleteParams = {
            TableName: 'PackageMetadata',
            Key: { ID: id },
        };
        await client.send(new DeleteCommand(deleteParams));
        console.log(`Successfully deleted metadata for package ID: ${id}`);
    } catch (error) {
        console.error(`Error deleting package metadata for ID: ${id}`, error);
        throw new Error("Failed to delete package metadata.");
    }
}

// Delete the package file from S3
async function deletePackageFromS3(client: S3, s3Key: string | undefined): Promise<void> {
    const bucketName = getEnvVariable('S3_BUCKET_NAME');

    if (!s3Key) {
        throw new Error('S3 key not provided for deletion.');
    }

    try {
        await client.send(
            new DeleteObjectCommand({
                Bucket: bucketName,
                Key: s3Key,
            })
        );
        console.log(`Successfully deleted file from S3 with key: ${s3Key}`);
    } catch (error) {
        console.error(`Error deleting file from S3 with key: ${s3Key}`, error);
        throw new Error('Failed to delete package file from S3.');
    }
}

async function deleteDocumentById(domainEndpoint: string, indexName: string, documentId: string) {
    const credentials = await defaultProvider()();

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

    aws4.sign(request, credentials);

    console.log(`Deleting document with ID '${documentId}' from index: '${indexName}'`);
    try {
        const response = await axios({
            method: request.method,
            url: `https://${request.host}${request.path}`,
            headers: request.headers,
        });
        console.log(`Document with ID '${documentId}' deleted from index '${indexName}':`, response.data);
    } catch (error) {
        console.error(`Error deleting document with ID '${documentId}' from index '${indexName}':`, error);
        throw new Error(`Failed to delete document with ID '${documentId}' from index '${indexName}'.`);
    }
}


// Create success response
function createSuccessResponse(packageName: string, version: string): APIGatewayProxyResult {
    return {
        statusCode: 200,
        headers: {
            'Access-Control-Allow-Origin': '*',
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            message: `Package ${packageName} version ${version} deleted successfully.`,
        }),
    };
}
