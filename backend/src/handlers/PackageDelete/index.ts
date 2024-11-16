import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, DeleteCommand } from '@aws-sdk/lib-dynamodb';
import { S3, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { PackageTableRow } from './interfaces';
import { createErrorResponse, getPackageById } from './utils';

// Dependency injection for testability
const dynamoDBClient = DynamoDBDocumentClient.from(new DynamoDBClient());
const s3Client = new S3();

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
    try {
        const id = getIdFromEvent(event);
        if (!id) {
            return createErrorResponse(400, "Missing ID in path parameters.");
        }

        const existingPackage = await fetchPackageById(id);
        if (!existingPackage) {
            return createErrorResponse(404, `Package with ID ${id} not found.`);
        }

        await deletePackageFromDynamoDB(dynamoDBClient, id);

        await deletePackageFromS3(s3Client, existingPackage.s3Key);

        return createSuccessResponse(existingPackage.PackageName, existingPackage.Version);
    } catch (error) {
        console.error("Error during DELETE operation:", error);
        return createErrorResponse(500, "Internal server error occurred while deleting the package.");
    }
};

// Extract ID from the event
function getIdFromEvent(event: APIGatewayProxyEvent): string | undefined {
    const id = event.pathParameters?.id;
    if (!id) {
        console.error("Missing ID in event path parameters.");
    }
    return id;
}

// Fetch package by ID from DynamoDB
async function fetchPackageById(id: string): Promise<PackageTableRow | null> {
    try {
        return await getPackageById(id);
    } catch (error) {
        console.error(`Error fetching package by ID: ${id}`, error);
        throw new Error("Error fetching package data.");
    }
}

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


// Validate environment variables
function getEnvVariable(name: string): string {
    const value = process.env[name];
    if (!value) {
        throw new Error(`Environment variable ${name} is not defined`);
    }
    return value;
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
