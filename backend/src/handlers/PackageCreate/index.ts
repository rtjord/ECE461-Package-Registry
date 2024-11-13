import { S3 } from '@aws-sdk/client-s3';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { createErrorResponse, getPackageById, updatePackageHistory, savePackageMetadata } from './utils';
import { PackageData, PackageTableRow, User } from './interfaces';
import { createHash } from 'crypto';
import JSZip from "jszip";
import { exec } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import archiver from 'archiver';

const s3 = new S3();
const dynamoDBClient = DynamoDBDocumentClient.from(new DynamoDBClient());
const execAsync = promisify(exec);

// Generate a unique package ID based on the package name and version
function generatePackageID(name: string, version: string): string {
    return createHash('sha256').update(name + version).digest('base64url').slice(0, 20);
}

// Extract package.json and README.md from the uploaded zip file
async function extractFilesFromZip(zipBuffer: Buffer) {
    const zip = await JSZip.loadAsync(zipBuffer);

    const packageJsonFile = zip.file(/package\.json$/i)[0];
    const readmeFile = zip.file(/readme\.md$/i)[0];

    return {
        packageJson: packageJsonFile ? await packageJsonFile.async('string') : null,
        readme: readmeFile ? await readmeFile.async('string') : null,
    };
}

// Extract metadata (name and version) from package.json content
function extractMetadataFromPackageJson(packageJson: string) {
    const metadata = JSON.parse(packageJson);
    return {
        packageName: metadata.name ?? null,
        version: metadata.version ?? null,
    };
}

// Upload the zip file to S3 and return the file URL
async function uploadToS3(fileContent: Buffer, packageName: string, version: string): Promise<string> {
    const s3Key = `uploads/${packageName}-${version}.zip`;
    const bucketName = process.env.S3_BUCKET_NAME;

    if (!bucketName) throw new Error('S3_BUCKET_NAME is not defined in environment variables');

    await s3.putObject({
        Bucket: bucketName,
        Key: s3Key,
        Body: fileContent,
        ContentType: 'application/zip',
    });

    return `https://${bucketName}.s3.amazonaws.com/${s3Key}`;
}

// Clone GitHub repository and compress it to a zip file
async function cloneAndZipRepository(repoUrl: string): Promise<Buffer> {
    const tempDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'repo-'));
    const repoName = path.basename(repoUrl, '.git');
    const repoPath = path.join(tempDir, repoName);

    try {
        // Clone the GitHub repository
        await execAsync(`git clone ${repoUrl} ${repoPath}`);

        // Create a zip archive of the cloned repository
        const zipPath = path.join(tempDir, `${repoName}.zip`);
        const output = fs.createWriteStream(zipPath);
        const archive = archiver('zip', {
            zlib: { level: 9 }, // Set the compression level
        });

        archive.pipe(output);
        archive.directory(repoPath, false);
        await archive.finalize();

        return fs.promises.readFile(zipPath);
    } finally {
        // Clean up temporary files
        await fs.promises.rm(tempDir, { recursive: true, force: true });
    }
}

// Main Lambda handler function
export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
    try {
        // Ensure the request body is present
        if (!event.body) {
            return createErrorResponse(400, 'Request body is missing.');
        }

        const requestBody = typeof event.body === 'string' ? JSON.parse(event.body) : event.body;

        // Validate that exactly one of Content or URL is provided
        if ((!requestBody.Content && !requestBody.URL) || (requestBody.Content && requestBody.URL)) {
            return createErrorResponse(400, 'Exactly one of Content or URL must be provided.');
        }

        let fileContent: Buffer;

        if (requestBody.Content) {
            // Decode the uploaded file content
            fileContent = Buffer.from(requestBody.Content, 'base64');
        } else if (requestBody.URL) {
            // Clone the GitHub repository and zip it
            fileContent = await cloneAndZipRepository(requestBody.URL);
        } else {
            return createErrorResponse(400, 'Invalid request. No valid content or URL provided.');
        }

        const { packageJson } = await extractFilesFromZip(fileContent);

        // Ensure package.json is present in the uploaded zip
        if (!packageJson) {
            return createErrorResponse(400, 'package.json not found in the uploaded zip file.');
        }

        // Extract package metadata (name and version)
        const { packageName, version } = extractMetadataFromPackageJson(packageJson);

        if (!packageName || !version) {
            return createErrorResponse(400, 'Package name or version could not be determined.');
        }

        // Generate a unique ID for the package
        const packageId = generatePackageID(packageName, version);
        const existingPackage = await getPackageById(packageId);

        // Check if the package already exists
        if (existingPackage) {
            return createErrorResponse(409, 'Package already exists.');
        }

        // Upload the package zip to S3
        const fileUrl = await uploadToS3(fileContent, packageName, version);
        const fileSizeInMB = fileContent.length / (1024 * 1024);

        // Save the package metadata to DynamoDB
        await savePackageMetadata(packageId, packageName, version, fileUrl, fileSizeInMB);

        // Log the package creation in the package history
        const user: User = {
            name: "ece30861defaultadminuser",
            isAdmin: true,
        };

        await updatePackageHistory(packageName, version, packageId, user, "CREATE");

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
    } catch (error) {
        console.error("Error during POST package:", error);
        return createErrorResponse(500, 'Failed to upload package.');
    }
};
