import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import { S3Client } from '@aws-sdk/client-s3';
import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { SecretsManagerClient } from "@aws-sdk/client-secrets-manager";

const commonPath = process.env.COMMON_PATH || '/opt/nodejs/common';
const { createErrorResponse, generatePackageID, getSecret, getScores, getEnvVariable, extractFieldFromPackageJson, getRepoUrl } = require(`${commonPath}/utils`);
const { debloatPackage, calculateDependenciesCost, cloneAndZipRepository, extractPackageJsonFromZip, extractReadmeFromZip } = require(`${commonPath}/zip`);
const { getPackageByName, updatePackageHistory, uploadPackageMetadata } = require(`${commonPath}/dynamodb`);
const { uploadToS3 } = require(`${commonPath}/s3`);
const { uploadReadme } = require(`${commonPath}/opensearch`);

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const interfaces = require(`${commonPath}/interfaces`);
type PackageData = typeof interfaces.PackageData;
type PackageTableRow = typeof interfaces.PackageTableRow;
type User = typeof interfaces.User;
type Package = typeof interfaces.Package;
type PackageMetadata = typeof interfaces.PackageMetadata;
type PackageRating = typeof interfaces.PackageRating;


// Main Lambda handler function
export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
    try {
        // Initialize the AWS clients
        const dynamoDBClient = DynamoDBDocumentClient.from(new DynamoDBClient({ 
            region: 'us-east-2',
        }));
        const s3Client = new S3Client({
            region: 'us-east-2',
        });
        const secretsManagerClient = new SecretsManagerClient({
            region: "us-east-2",
        });

        // Ensure the request body is present
        if (!event.body) {
            return createErrorResponse(400, 'Request body is missing.');
        }

        // The request body should be a PackageData object
        const requestBody: PackageData = typeof event.body === 'string' ? JSON.parse(event.body) : event.body;

        // Validate that exactly one of Content or URL is provided
        if ((!requestBody.Content && !requestBody.URL) || (requestBody.Content && requestBody.URL)) {
            return createErrorResponse(400, 'Exactly one of Content or URL must be provided.');
        }

        // Initialize package name and version
        const packageName = requestBody.Name;
        let version = null;

        // Check if any packages with the same name already exist
        const existingPackages: PackageMetadata[] = await getPackageByName(dynamoDBClient, packageName);
        if (existingPackages.length > 0) {
            return createErrorResponse(409, 'Package already exists.');
        }
        
        let fileContent: Buffer;
        let rating: PackageRating | null = null;

        // If Content is provided, use it directly
        if (requestBody.Content) {
            // Convert base64-encoded content to a Buffer
            fileContent = Buffer.from(requestBody.Content, 'base64');
        } else if (requestBody.URL) { // If URL is provided
            // Get the rating of the package
            const secret = await getSecret(secretsManagerClient, "GitHubToken");
            const token = JSON.parse(secret) as { GitHubToken: string };
            rating = await getScores(token.GitHubToken, requestBody.URL);

            // If the rating is less than 0.5, do not upload the package
            if (rating.NetScore < 0.5) {
                console.log('In the future, Package should not be uploaded due to the disqualified rating.');
                // return createErrorResponse(424, 'Package is not uploaded due to the disqualified rating.');
            }
            
            // Extract the version from the NPM url, if present
            const urlVersion: string = extractVersionFromNpmUrl(requestBody.URL);
            
            // Fetch the GitHub repository URL from the NPM package url
            const repoUrl = await getRepoUrl(requestBody.URL);
            if (!repoUrl) {
                return createErrorResponse(400, 'Failed to fetch GitHub repository URL from npm package.');
            }
            // Clone the GitHub repository with the correct version and zip it
            fileContent = await cloneAndZipRepository(repoUrl, urlVersion);
            if (urlVersion) {
                version = urlVersion;
            }
        } else {
            return createErrorResponse(400, 'Invalid request. No valid content or URL provided.');
        }

        // Extract package.json and README.md from the zip file
        const packageJson = await extractPackageJsonFromZip(fileContent);
        const readme = await extractReadmeFromZip(fileContent);

        // If the version is not provided, try to extract it from package.json
        if (!version && packageJson) {
            version = extractFieldFromPackageJson(packageJson, 'version');
        }

        // If the version is still not provided, default to 1.0.0
        version = version || '1.0.0';

        // Generate a unique ID for the package
        const packageId = generatePackageID(packageName, version);

        const metadata = {
            Name: packageName,
            Version: version,
            ID: packageId,
        };

        // upload readme to opensearch
        if (readme){
            await uploadReadme(getEnvVariable('DOMAIN_ENDPOINT'), 'readmes', readme, metadata);
        }
        // Upload the package zip to S3
        if (requestBody.debloat) {
            // Debloat the package content
            fileContent = await debloatPackage(fileContent);
        }
        const s3Key = await uploadToS3(s3Client, fileContent, packageName, version);
        const standaloneCost = fileContent.length / (1024 * 1024);
        const dependenciesCost = await calculateDependenciesCost(packageJson);
        const totalCost = standaloneCost + dependenciesCost;

        // Save the package metadata to DynamoDB
        const row: PackageTableRow = {
            ID: packageId,
            PackageName: packageName,
            Version: version,
            URL: requestBody.URL,
            s3Key: s3Key,
            JSProgram: requestBody.JSProgram,
            standaloneCost: standaloneCost,
            totalCost: totalCost,
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

function extractVersionFromNpmUrl(url: string): string {
    const regex = /https:\/\/www\.npmjs\.com\/package\/([^/]+)(?:\/v\/([\d.]+))?/;
    const match = url.match(regex);
    return match ? match[2] : '';
}
