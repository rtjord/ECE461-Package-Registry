import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import dotenv from 'dotenv';
dotenv.config();

const utilsPath = process.env.UTILS_PATH || '/opt/nodejs/common/utils';

// eslint-disable-next-line @typescript-eslint/no-require-imports 
const { createErrorResponse, getPackageByName, updatePackageHistory, uploadPackageMetadata } = require(utilsPath);

const interfacesPath = process.env.INTERFACES_PATH || '/opt/nodejs/common/interfaces';


/* eslint-disable @typescript-eslint/no-require-imports, @typescript-eslint/no-unused-vars */
const interfaces = require(interfacesPath);
type PackageData = typeof interfaces.PackageData;
type PackageTableRow = typeof interfaces.PackageTableRow;
type User = typeof interfaces.User;
type Package = typeof interfaces.Package;
type PackageMetadata = typeof interfaces.PackageMetadata;
type PackageRating = typeof interfaces.PackageRating;

const servicesPath = process.env.SERVICES_PATH || '/opt/nodejs/services/rate';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { runAnalysis } = require(`${servicesPath}/tools/scripts`);
const { getEnvVars } = require(`${servicesPath}/tools/getEnvVars`);
const ratingInterfaces = require(`${servicesPath}/utils/interfaces`);
const { metricCalc } = require(`${servicesPath}/tools/metricCalc`);

type envVars = typeof ratingInterfaces.envVars;
type repoData = typeof ratingInterfaces.repoData;
type metricData = typeof ratingInterfaces.metricData;


import { createHash } from 'crypto';
import JSZip from "jszip";
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import git from 'isomorphic-git';
import http from 'isomorphic-git/http/node';
import yazl from 'yazl';
import axios from 'axios';
import aws4 from 'aws4';
import { defaultProvider } from '@aws-sdk/credential-provider-node';

const s3Client = new S3Client({
    region: 'us-east-2',
    useArnRegion: false, // Ignore ARN regions and stick to 'us-east-2'
});


type NpmMetadata = {
    repository?: {
        url?: string;
    };
};

// Use this code snippet in your app.
// If you need more information about configurations or implementing the sample code, visit the AWS docs:
// https://docs.aws.amazon.com/sdk-for-javascript/v3/developer-guide/getting-started.html

import {
    SecretsManagerClient,
    GetSecretValueCommand
} from "@aws-sdk/client-secrets-manager";

const client = new SecretsManagerClient({
    region: "us-east-2",
});


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
            const secret = await getSecret("GitHubToken");
            const token = JSON.parse(secret) as { GitHubToken: string };
            process.env.GITHUB_TOKEN = token.GitHubToken;
            process.env.LOG_FILE = '/tmp/log.txt';
            process.env.LOG_LEVEL = '1';
            rating = await getScores(requestBody.URL);
            if (rating.NetScore < 0.5) {
                console.log('In the future, Package should not be uploaded due to the disqualified rating.');
                // return createErrorResponse(424, 'Package is not uploaded due to the disqualified rating.');
            }

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
        } else {
            return createErrorResponse(400, 'Invalid request. No valid content or URL provided.');
        }

        // Extract package.json and README.md from the zip file
        const { packageJson, readme } = await extractFilesFromZip(fileContent);

        // If the version is not provided, try to extract it from package.json
        if (!version && packageJson) {
            version = extractVersionFromPackageJson(packageJson);
        }

        // If the version is still not provided, default to 1.0.0
        version = version || '1.0.0';

        // Generate a unique ID for the package
        const packageId = generatePackageID(packageName, version);

        // upload readme to opensearch in the future
        console.log(readme);
        // if (readme){
        //     await uploadReadme('', 'readmes', readme, packageId);
        // }

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
        return createErrorResponse(500, `Failed to upload package. ${error}`);
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


async function uploadToS3(fileContent: Buffer, packageName: string, version: string): Promise<string> {
    const s3Key = `uploads/${packageName}-${version}.zip`;
    const bucketName = process.env.S3_BUCKET_NAME;

    if (!bucketName) throw new Error('S3_BUCKET_NAME is not defined in environment variables');

    const command = new PutObjectCommand({
        Bucket: bucketName,
        Key: s3Key,
        Body: fileContent,
        ContentType: 'application/zip',
    });

    await s3Client.send(command);

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

async function uploadReadme(
  domainEndpoint: string,
  indexName: string,
  readmeContent: string,
  id: string
) {
  try {
    // Get AWS credentials
    const credentials = await defaultProvider()();

    // Prepare the OpenSearch request
    const request = {
      host: domainEndpoint.replace(/^https?:\/\//, ''), // Extract the hostname
      method: 'PUT',
      path: `/${indexName}/_doc/${id}`, // Document path in OpenSearch
      service: 'es', // AWS service name for OpenSearch
      body: JSON.stringify({
        content: readmeContent,
        timestamp: new Date().toISOString(),
      }),
      headers: {
        'Content-Type': 'application/json',
      },
    };

    // Sign the request using aws4
    aws4.sign(request, credentials);

    // Send the request using axios
    const response = await axios({
      method: request.method,
      url: `https://${request.host}${request.path}`, // Construct full URL
      headers: request.headers,
      data: request.body, // Attach request body
    });

    console.log('Document indexed:', response.data);
  } catch (error) {
    // Error handling
    const err = error as any;
    console.error(
      'Error indexing document:',
      err.response?.data || err.message
    );
  }
}

async function getScores(url: string): Promise<metricData[]> {
    const envVar: envVars = new getEnvVars();
    const runAnalysisClass = new runAnalysis(envVar);

    try {
        const repoData: repoData[] = await runAnalysisClass.runAnalysis([url]);
        const repo = repoData[0];
        const metricCalcClass = new metricCalc();
        const result: metricData = metricCalcClass.getValue(repo);

        return result;
    } catch (error) {
        throw new Error(`Could not execute URL analysis of modules: ${error}`);
    }
}

export async function getSecret(secret_name: string): Promise<string> {
    const response = await client.send(
        new GetSecretValueCommand({
            SecretId: secret_name,
            VersionStage: "AWSCURRENT", // VersionStage defaults to AWSCURRENT if unspecified
        })
    );
    const secret = response.SecretString || "";
    return secret;
}
