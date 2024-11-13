import { S3 } from '@aws-sdk/client-s3';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, PutCommand } from '@aws-sdk/lib-dynamodb';
import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { createErrorResponse, getPackageById, updatePackageHistory, savePackageMetadata } from './utils';
import { PackageData, PackageTableRow, PackageHistoryEntry, User } from './interfaces';
import { createHash } from 'crypto';
import JSZip from "jszip";

const s3 = new S3();
const dynamoDBClient = DynamoDBDocumentClient.from(new DynamoDBClient());

function generatePackageID(name: string, version: string): string {
    const input = name + version;
    const hash = createHash('sha256').update(input).digest('base64url');
    return hash.slice(0, 20);
}

async function extractFilesFromZip(zipBuffer: Buffer) {
    const zip = new JSZip();
    const contents = await zip.loadAsync(zipBuffer);

    let packageJsonContent = null;
    let readmeContent = null;

    // Iterate through each file to find `package.json` and `README.md`
    contents.forEach((relativePath, file) => {
        if (relativePath.endsWith('/package.json')) {
            packageJsonContent = file.async('string');
        } else if (relativePath.toLowerCase().endsWith('/readme.md')) {
            readmeContent = file.async('string');
        }
    });

    // Wait for the async content retrieval if the files were found
    return {
        packageJson: packageJsonContent ? await packageJsonContent : null,
        readme: readmeContent ? await readmeContent : null,
    };
}


function extractMetadataFromPackageJson(packageJson: string) {
    const metadata = JSON.parse(packageJson);
    return {
        packageName: metadata.name ?? null,
        version: metadata.version ?? null,
    };
}

async function uploadToS3(fileContent: Buffer, packageName: string, version: string): Promise<string> {
    const s3Key = `uploads/${packageName}-${version}.zip`;
    const bucketName = process.env.S3_BUCKET_NAME;
    console.log("bucketName: ", bucketName);
    const s3Params = {
        Bucket: bucketName,
        Key: s3Key,
        Body: fileContent,
        ContentType: 'application/zip',
    };

    await s3.putObject(s3Params);
    return `https://${s3Params.Bucket}.s3.amazonaws.com/${s3Params.Key}`;
}

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
    try {
        if (!event.body) {
            return createErrorResponse(400, 'Request body is missing.');
        }

        const requestBody = event.body && typeof event.body === 'string' ? JSON.parse(event.body) : event.body;

        // Validate the request body
        if ((!requestBody.Content && !requestBody.URL) || (requestBody.Content && requestBody.URL)) {
            return createErrorResponse(400, 'Exactly one of Content or URL must be provided.');
        }

        let packageName: string | null = null;
        let version: string | null = null;
        let fileUrl: string | null = null;
        let fileSizeInMB = 0;

        // Check if the request body contains the file content
        if (requestBody.Content) {
            const fileContent = Buffer.from(requestBody.Content, 'base64');
            const { packageJson, readme } = await extractFilesFromZip(fileContent);

            if (!packageJson) {
                return createErrorResponse(400, 'package.json not found in the uploaded zip file.');
            }

            const metadata = extractMetadataFromPackageJson(packageJson);
            packageName = metadata.packageName;
            version = metadata.version;
            if (!packageName || !version) {
                return createErrorResponse(400, 'Package name or version could not be determined.');
            }

            const packageId = generatePackageID(packageName, version);
            const existingPackage: PackageTableRow | null = await getPackageById(packageId);
            if (existingPackage) {
                return createErrorResponse(409, 'Package already exists.');
            }


            // Upload the file to S3
            fileUrl = await uploadToS3(fileContent, packageName, version);

            // Calculate the file size in MB
            fileSizeInMB = fileContent.length / (1024 * 1024);


            // Save the metadata to DynamoDB
            await savePackageMetadata(packageId, packageName, version, fileUrl, fileSizeInMB);

            // Log the package history
            const user: User = {
                name: "ece30861defaultadminuser",
                isAdmin: true,
            };

            await updatePackageHistory(packageName, version, packageId, user, "CREATE");
            console.log('Logged package history.');

            return {
                statusCode: 201,
                headers: {
                    'Access-Control-Allow-Origin': '*',
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    message: 'Package uploaded and metadata stored successfully.',
                    metadata: {
                        Name: packageName,
                        Version: version,
                        ID: packageId,
                    },
                    data: {
                        Content: fileUrl,
                    },
                }),
            };
        }

        return createErrorResponse(400, 'Cannot handle URLs yet.');

    } catch (error) {
        console.error("Error during POST package:", error);
        return createErrorResponse(500, 'Failed to upload package.');
    }
};
