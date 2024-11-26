import { S3Client, GetObjectCommand, GetObjectCommandOutput } from '@aws-sdk/client-s3';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';

const utilsPath = process.env.UTILS_PATH || 'common/utils';
const { createErrorResponse, getPackageById, updatePackageHistory } = require(utilsPath);
import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';

const interfacesPath = process.env.INTERFACES_PATH || 'common/interfaces';
const interfaces = require(interfacesPath);

type PackageTableRow = typeof interfaces.PackageTableRow;
type User = typeof interfaces.User;
type Package = typeof interfaces.Package;


export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
    try {
        // Initialize clients
        const dynamoDBClient = DynamoDBDocumentClient.from(new DynamoDBClient());
        const s3Client = new S3Client({
            region: 'us-east-2',
            useArnRegion: false, // Ignore ARN regions and stick to 'us-east-2'
        });

        // Extract and validate the package ID
        const id = getIdFromEvent(event);
        if (!id) {
            return createErrorResponse(400, "Missing ID in path parameters.");
        }

        // Fetch package details from DynamoDB
        const existingPackage: PackageTableRow | null = await getPackageById(dynamoDBClient, id);
        if (!existingPackage) {
            return createErrorResponse(404, 'Package not found.');
        }

        const { ID: packageId, PackageName: packageName, Version: version, s3Key, URL: url } = existingPackage;
        const bucketName = getEnvVariable('S3_BUCKET_NAME');

        // Fetch S3 object content if S3 key exists
        const s3Result = s3Key ? await getS3ObjectContent(s3Client, bucketName, s3Key) : { base64Content: null, fileUrl: null };
        if (!s3Result.base64Content) {
            return createErrorResponse(500, 'Failed to retrieve package content.');
        }

        const user: User = {
            name: "ece30861defaultadminuser",
            isAdmin: true,
        };

        // Update package history in DynamoDB
        await updatePackageHistory(
            dynamoDBClient,
            packageName,
            version,
            packageId,
            user,
            "DOWNLOAD"
        );

        // Prepare the response
        const responseBody: Package = {
            metadata: {
                Name: packageName,
                Version: version,
                ID: packageId,
            },
            data: {
                Name: packageName,
                Content: s3Result.base64Content,
                URL: url,
                JSProgram: existingPackage.JSProgram,
            },
        };

        return {
            statusCode: 200,
            headers: { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json' },
            body: JSON.stringify(responseBody),
        };
    } catch (error) {
        console.error('Error processing request:', error);
        return createErrorResponse(500, 'Failed to retrieve package.');
    }
};

// Extract ID from the event
function getIdFromEvent(event: APIGatewayProxyEvent): string {
    const id = event.pathParameters?.id;
    if (!id) {
        throw new Error("Missing ID in path parameters.");
    }
    return id;
}

// Validate environment variables
function getEnvVariable(name: string): string {
    const value = process.env[name];
    if (!value) {
        throw new Error(`Environment variable ${name} is not defined`);
    }
    return value;
}


// Fetch S3 object content
async function getS3ObjectContent(
    s3Client: S3Client,
    bucketName: string,
    key: string
): Promise<{ base64Content: string | null; fileUrl: string | null }> {
    try {
        const s3Object: GetObjectCommandOutput = await s3Client.send(new GetObjectCommand({ Bucket: bucketName, Key: key }));
        const fileUrl = `https://${bucketName}.s3.amazonaws.com/${key}`;

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        if (s3Object.Body && typeof (s3Object.Body as any)[Symbol.asyncIterator] === 'function') {
            const chunks: Uint8Array[] = [];
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            for await (const chunk of s3Object.Body as any) {
                chunks.push(chunk);
            }
            const fileBuffer = Buffer.concat(chunks);
            return { base64Content: fileBuffer.toString('base64'), fileUrl };
        }

        return { base64Content: null, fileUrl };
    } catch (error) {
        console.error('Error fetching S3 object:', error);
        return { base64Content: null, fileUrl: null };
    }
}
