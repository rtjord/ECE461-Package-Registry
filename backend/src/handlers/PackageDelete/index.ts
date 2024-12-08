import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import { S3Client } from '@aws-sdk/client-s3';
import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';

const commonPath = process.env.COMMON_PATH || '/opt/nodejs/common';
const { createErrorResponse } = require(`${commonPath}/utils`);
const { getPackageById, deletePackageFromDynamoDB } = require(`${commonPath}/dynamodb`);
const { deletePackageFromS3 } = require(`${commonPath}/s3`);
const { deleteFromOpenSearch } = require(`${commonPath}/opensearch`);
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const interfaces = require(`${commonPath}/interfaces`);
type PackageTableRow = typeof interfaces.PackageTableRow;

 
export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
    try {
        // Inject clients
        const dynamoDBClient = DynamoDBDocumentClient.from(new DynamoDBClient());
        const s3Client = new S3Client({
            region: 'us-east-2',
        });


        const id = event.pathParameters?.id;
        if (!id) {
            return createErrorResponse(400, "Missing ID in path parameters.");
        }

        const existingPackage: PackageTableRow | null = await getPackageById(dynamoDBClient, id);
        if (!existingPackage) {
            return createErrorResponse(404, `Package with ID ${id} not found.`);
        }

        console.log(`Deleting package with ID: ${id}`);
        await deletePackageFromDynamoDB(dynamoDBClient, id);
        console.log(`Deleted package metadata for ID: ${id}`);

        await deletePackageFromS3(s3Client, existingPackage.s3Key);
        console.log(`Deleted package file from S3 with key: ${existingPackage.s3Key}`);

        await deleteFromOpenSearch('readmes', id);
        await deleteFromOpenSearch('packagejsons', id);
        await deleteFromOpenSearch('recommend', id);
        console.log(`Deleted document with ID: ${id} from OpenSearch index.`);

        return createSuccessResponse(existingPackage.PackageName, existingPackage.Version);
    } catch (error) {
        console.error("Error during DELETE operation:", error);
        return createErrorResponse(500, "Internal server error occurred while deleting the package.");
    }
};

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
