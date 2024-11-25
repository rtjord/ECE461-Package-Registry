import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import { S3 } from '@aws-sdk/client-s3';
import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { createErrorResponse, getPackageByName, updatePackageHistory, uploadPackageMetadata } from './utils';
import { PackageData, PackageTableRow, User, Package, PackageMetadata, PackageRating } from './interfaces';
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

        // Ensure the request body is present
        if (!event.body) {
            return createErrorResponse(400, 'Request body is missing.');
        }

        const requestBody: PackageData = typeof event.body === 'string' ? JSON.parse(event.body) : event.body;

        // Validate that exactly one of Content or URL is provided
        if ((!requestBody.Content && !requestBody.URL) || (requestBody.Content && requestBody.URL)) {
            return createErrorResponse(400, 'Exactly one of Content or URL must be provided.');
        }

        const packageName = requestBody.Name;
        let version = null;

        // Check if any package with the same name already exists
        const existingPackage: PackageMetadata[] = await getPackageByName(dynamoDBClient, packageName);
        if (existingPackage.length > 0) {
            return createErrorResponse(409, 'Package already exists.');
        }

        // Convert the uploaded content/url to a buffer representing the zip file
        let fileContent: Buffer;
        let rating: PackageRating | null = null;
        if (requestBody.Content) {
            // Decode the uploaded file content
            fileContent = Buffer.from(requestBody.Content, 'base64');
        } else if (requestBody.URL) {
            const { packageName: urlPackageName, version: urlVersion } = extractPackageInfoFromURL(requestBody.URL);
            // Fetch the GitHub repository URL from the npm package
            const repoUrl = await getGitHubRepoUrl(urlPackageName);
            if (!repoUrl) {
                return createErrorResponse(400, 'Failed to fetch GitHub repository URL from npm package.');
            }
            // Clone the GitHub repository and zip it
            console.log(`Cloning repository from ${repoUrl}`);
            fileContent = await cloneAndZipRepository(repoUrl, urlVersion);
            if (urlVersion) {
                version = urlVersion;
            }
            rating = {
                RampUp: 1,
                Correctness: 1,
                BusFactor: 1,
                ResponsiveMaintainer: 1,
                LicenseScore: 1,
                GoodPinningPractice: 1,
                PullRequest: 1,
                NetScore: 1,
                RampUpLatency: 1,
                CorrectnessLatency: 1,
                BusFactorLatency: 1,
                ResponsiveMaintainerLatency: 1,
                LicenseScoreLatency: 1,
                GoodPinningPracticeLatency: 1,
                PullRequestLatency: 1,
                NetScoreLatency: 1,
            }
        } else {
            return createErrorResponse(400, 'Invalid request. No valid content or URL provided.');
        }

        // Extract package.json and README.md from the zip file
        const { packageJson, readme } = await extractFilesFromZip(fileContent);
        // upload readme to opensearch in the future
        console.log(readme);

        // If the version is not provided, try to extract it from package.json
        if (!version && packageJson) {
            version = extractVersionFromPackageJson(packageJson);
        }

        // If the version is still not provided, default to 1.0.0
        version = version || '1.0.0';

        // Generate a unique ID for the package
        const packageId = generatePackageID(packageName, version);

        // Upload the package zip to S3
        const s3Key = await uploadToS3(fileContent, packageName, version);
        const standaloneCost = fileContent.length / (1024 * 1024);

        // Save the package metadata to DynamoDB
        const row: PackageTableRow = {
            ID: packageId,
            PackageName: packageName,
            Version: version,
            URL: requestBody.URL,
            s3Key: s3Key,
            JSProgram: requestBody.JSProgram,
            standaloneCost: standaloneCost,
            ...(rating && { Rating: rating }),
        };
        await uploadPackageMetadata(dynamoDBClient, row);

        // Log the package creation in the package history
        const user: User = {
            name: "ece30861defaultadminuser",
            isAdmin: true,
        };

        await updatePackageHistory(dynamoDBClient, packageName, version, packageId, user, "CREATE");

        const responseBody: Package = {
            metadata: {
                Name: packageName,
                Version: version,
                ID: packageId,
            },
            data: {
                Name: packageName,
                Content: fileContent.toString('base64'),
                URL: requestBody.URL,
                JSProgram: requestBody.JSProgram,
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

    return s3Key;
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