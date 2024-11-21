import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import { S3 } from '@aws-sdk/client-s3';
import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { createErrorResponse, getPackageById, getPackageByName, updatePackageHistory, uploadPackageMetadata } from './utils';
import { PackageData, PackageTableRow, User, Package, PackageMetadata } from './interfaces';
import { createHash } from 'crypto';
import JSZip from "jszip";
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import git from 'isomorphic-git';
import http from 'isomorphic-git/http/node';
import yazl from 'yazl';
import axios from 'axios';

const s3 = new S3();


type NpmMetadata = {
    repository?: {
        url?: string;
    };
};


// Main Lambda handler function
export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
    try {
        const dynamoDBClient = DynamoDBDocumentClient.from(new DynamoDBClient());

        // Extract packageName and version from the path (assuming package id is passed in the path)
        const oldId = event.pathParameters?.id;

        if (!oldId || !event.body) {
            return createErrorResponse(400, 'Missing ID or request body.');
        }

        const requestBody: Package = typeof event.body === 'string' ? JSON.parse(event.body) : event.body;

        // In this metadata, the name of must match name of the old package
        // the version must be a new version number
        // the ID must be the same as the old package
        const metadata: PackageMetadata = requestBody.metadata;
        const data: PackageData = requestBody.data;

        // We can do these checks before querying the database

        // Check that the ID in the request body matches the ID in the path
        if (metadata.ID !== oldId) {
            return createErrorResponse(400, 'ID in the request body does not match the ID in the path.');
        }

        // Check that exactly one of Content or URL is provided
        if ((!data.Content && !data.URL) || (data.Content && data.URL)) {
            return createErrorResponse(400, 'Exactly one of Content or URL must be provided.');
        }

        // Now, start checking against the database

        // Check if any package with the give id already exists
        const existingPackage = await getPackageById(dynamoDBClient, oldId);
        if (!existingPackage) {
            return createErrorResponse(404, 'Package not found.');
        }

        if (metadata.Name !== existingPackage.PackageName) {
            return createErrorResponse(400, 'Package name in the metadata does not match the existing package name.');
        }

        // Get all previous versions of the package
        const previousVersions: PackageMetadata[] = await getPackageByName(dynamoDBClient, metadata.Name);

        // Check if the new version is valid
        for (const version of previousVersions) {
            if (version.Version === metadata.Version) {
                return createErrorResponse(409, 'Package version already exists.');
            }
            if (!isNewVersionValid(version.Version, metadata.Version)) {
                return createErrorResponse(400, 'Invalid new version number.');
            }
        }

        // Convert the uploaded content/url to a buffer representing the zip file
        let fileContent: Buffer;
        if (data.Content) {
            // Decode the uploaded file content
            fileContent = Buffer.from(data.Content, 'base64');
        } else if (data.URL) {
            const { packageName: urlPackageName, version: urlVersion } = extractPackageInfoFromURL(data.URL);
            // Fetch the GitHub repository URL from the npm package
            const repoUrl = await getGitHubRepoUrl(urlPackageName);
            if (!repoUrl) {
                return createErrorResponse(400, 'Failed to fetch GitHub repository URL from npm package.');
            }
            // Clone the GitHub repository and zip it
            console.log(`Cloning repository from ${repoUrl}`);
            fileContent = await cloneAndZipRepository(repoUrl, urlVersion);
        } else {
            return createErrorResponse(400, 'Invalid request. No valid content or URL provided.');
        }

        // Extract package.json and README.md from the zip file
        // const { packageJson, readme } = await extractFilesFromZip(fileContent);

        // Generate a unique ID for the package
        const packageId = generatePackageID(data.Name, metadata.Version);

        // Upload the package zip to S3
        const s3Key = await uploadToS3(fileContent, data.Name, metadata.Version);
        const standaloneCost = fileContent.length / (1024 * 1024);

        // Save the package metadata to DynamoDB
        const row: PackageTableRow = {
            ID: packageId,
            PackageName: metadata.Name,
            Version: metadata.Version,
            URL: data.URL,
            s3Key: s3Key,
            JSProgram: data.JSProgram,
            standaloneCost: standaloneCost,
        };
        await uploadPackageMetadata(dynamoDBClient, row);

        // Log the package creation in the package history
        const user: User = {
            name: "ece30861defaultadminuser",
            isAdmin: true,
        };

        await updatePackageHistory(dynamoDBClient, metadata.Name, metadata.Version, packageId, user, "UPDATE");

        const responseBody: Package = {
            metadata: {
                Name: metadata.Name,
                Version: metadata.Version,
                ID: packageId,
            },
            data: {
                Name: metadata.Name,
                Content: fileContent.toString('base64'),
                URL: data.URL,
                JSProgram: data.JSProgram,
            },
        };
        return {
            statusCode: 201,
            headers: {
                'Access-Control-Allow-Origin': '*',
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(responseBody),
        };
    } catch (error) {
        console.error("Error during POST package:", error);
        return createErrorResponse(500, 'Failed to upload package.');
    }
};

function extractPackageInfoFromURL(url: string): { packageName: string; version: string | null } {
    const regex = /https:\/\/www\.npmjs\.com\/package\/([^/]+)(?:\/v\/([\d.]+))?/;
    const match = url.match(regex);

    if (match) {
        const packageName = match[1];
        const version = match[2] || null;

        return { packageName, version };
    } else {
        throw new Error("Invalid npm package URL");
    }
}

/**
 * Fetches the GitHub repository URL from an npm package and processes it.
 * @param packageName - The name of the npm package.
 * @returns The processed GitHub repository URL or null if an error occurs.
 */
export async function getGitHubRepoUrl(packageName: string): Promise<string | null> {
    try {
        // Fetch npm metadata
        const response = await axios.get<NpmMetadata>(`https://registry.npmjs.org/${packageName}`);
        const repoUrl = response.data.repository?.url;

        if (!repoUrl) {
            throw new Error("Repository URL not found in npm metadata.");
        }

        // Remove `git+` prefix if present
        return repoUrl.startsWith("git+") ? repoUrl.slice(4) : repoUrl;

    } catch (error) {
        console.error("Error fetching GitHub repository URL:", error);
        return null;
    }
}

// Generate a unique package ID based on the package name and version
export function generatePackageID(name: string, version: string): string {
    return createHash('sha256').update(name + version).digest('base64url').slice(0, 20);
}

// Extract package.json and README.md from the uploaded zip file
export async function extractFilesFromZip(zipBuffer: Buffer) {
    const zip = await JSZip.loadAsync(zipBuffer);

    const packageJsonFile = zip.file(/package\.json$/i)[0];
    const readmeFile = zip.file(/readme\.md$/i)[0];

    return {
        packageJson: packageJsonFile ? await packageJsonFile.async('string') : null,
        readme: readmeFile ? await readmeFile.async('string') : null,
    };
}

// Extract metadata (name and version) from package.json content
export function extractVersionFromPackageJson(packageJson: string) {
    const metadata = JSON.parse(packageJson);
    const version = metadata.version ?? '1.0.0';
    return version;
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
async function cloneAndZipRepository(repoUrl: string, version?: string | null): Promise<Buffer> {
    const tempDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'repo-'));
    const repoPath = path.join(tempDir, 'repo');

    try {
        // Clone the GitHub repository using isomorphic-git
        await git.clone({
            fs,
            http,
            dir: repoPath,
            url: repoUrl,
            singleBranch: true,
            depth: 1,
            ...(version && { ref: version }), // Checkout a specific version if provided
        });

        // Create a zip archive of the cloned repository
        return await zipDirectory(repoPath);
    } finally {
        // Clean up temporary files
        await fs.promises.rm(tempDir, { recursive: true, force: true });
    }
}

// Zip a directory and return a buffer of the zip file using yazl
async function zipDirectory(directoryPath: string): Promise<Buffer> {
    return new Promise<Buffer>((resolve, reject) => {
        const zipFile = new yazl.ZipFile();
        const filePaths = fs.readdirSync(directoryPath);

        for (const filePath of filePaths) {
            const fullPath = path.join(directoryPath, filePath);
            const stat = fs.statSync(fullPath);

            if (stat.isFile()) {
                zipFile.addFile(fullPath, filePath);
            } else if (stat.isDirectory()) {
                zipFile.addEmptyDirectory(filePath);
            }
        }

        const chunks: Buffer[] = [];
        zipFile.outputStream.on('data', (chunk) => chunks.push(chunk));
        zipFile.outputStream.on('end', () => resolve(Buffer.concat(chunks)));
        zipFile.outputStream.on('error', (err) => reject(err));

        zipFile.end();
    });
}


function isNewVersionValid(oldVersion: string, newVersion: string): boolean {
    // Split the versions into major, minor, and patch numbers
    const [oldMajor, oldMinor, oldPatch] = oldVersion.split('.').map(Number);
    const [newMajor, newMinor, newPatch] = newVersion.split('.').map(Number);

    // Validate the input versions
    if (
        [oldMajor, oldMinor, oldPatch, newMajor, newMinor, newPatch].some(
            (num) => isNaN(num) || num < 0
        )
    ) {
        throw new Error("Invalid version number format.");
    }

    // Check the major and minor match
    if (oldMajor === newMajor && oldMinor === newMinor) {
        // Ensure the patch number of the new version is greater
        return newPatch > oldPatch;
    }

    // Return true if major or minor do not match
    return true;
}