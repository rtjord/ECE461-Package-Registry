import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import { S3Client } from '@aws-sdk/client-s3';
import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { SecretsManagerClient } from "@aws-sdk/client-secrets-manager";

const commonPath = process.env.COMMON_PATH || '/opt/nodejs/common';
const { createErrorResponse, generatePackageID, getSecret, getScores, getRepoUrl } = require(`${commonPath}/utils`);
const { debloatPackage, cloneAndZipRepository, extractPackageJsonFromZip, extractReadmeFromZip } = require(`${commonPath}/zip`);
const { getPackageByName, updatePackageHistory, uploadPackageMetadata, getPackageById } = require(`${commonPath}/dynamodb`);
const { uploadToS3 } = require(`${commonPath}/s3`);
const { uploadToOpenSearch } = require(`${commonPath}/opensearch`);

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

        // Extract packageName and version from the path (assuming package id is passed in the path)
        const oldId = event.pathParameters?.id;
        console.log('Path ID:', oldId);

        if (!oldId || !event.body) {
            console.error('Missing ID or request body.');
            return createErrorResponse(400, 'Missing ID or request body.');
        }

        // The request body should be a Package object
        const requestBody: Package = typeof event.body === 'string' ? JSON.parse(event.body) : event.body;
        console.log('Request body:', requestBody);
        // In this metadata, the name of must match name of the old package
        // the version must be a new version number
        // the ID must be the same as the old package
        const metadata: PackageMetadata = requestBody.metadata;
        const data: PackageData = requestBody.data;

        // We can do these checks before querying the database

        // Check that the ID in the request body matches the ID in the path
        if (metadata.ID !== oldId) {
            console.error('ID in the request body does not match the ID in the path.');
            return createErrorResponse(400, 'ID in the request body does not match the ID in the path.');
        }

        // Check that exactly one of Content or URL is provided
        if ((!data.Content && !data.URL) || (data.Content && data.URL)) {
            console.error('Exactly one of Content or URL must be provided.');
            return createErrorResponse(400, 'Exactly one of Content or URL must be provided.');
        }

        // Now, start checking against the database

        // Check if any package with the give id already exists
        const existingPackage = await getPackageById(dynamoDBClient, oldId);
        if (!existingPackage) {
            console.error(`Package with id ${oldId} not found.`);
            return createErrorResponse(404, 'Package not found.');
        }

        if (metadata.Name !== existingPackage.PackageName) {
            console.error(`New name ${metadata.Name} does not match the existing package name ${existingPackage.PackageName}.`);
            return createErrorResponse(400, 'Package name in the metadata does not match the existing package name.');
        }

        // Get all previous versions of the package
        const previousVersions: PackageMetadata[] = await getPackageByName(dynamoDBClient, metadata.Name);
        console.log('Previous versions:', previousVersions);

        // Check if the new version is valid
        for (const version of previousVersions) {
            if (version.Version === metadata.Version) {
                console.error('Package version already exists.');
                return createErrorResponse(400, 'Package version already exists.');
            }
            if (!isNewVersionValid(version.Version, metadata.Version)) {
                console.error('Invalid new version number.');
                return createErrorResponse(400, 'Invalid new version number.');
            }
        }

        // Convert the uploaded content/url to a buffer representing the zip file
        let fileContent: Buffer;
        let rating: PackageRating | null = null;

        // If Content is provided, use it directly
        if (data.Content) {
            // Convert base64-encoded content to a Buffer
            fileContent = Buffer.from(data.Content, 'base64');
            console.log("Converted content to buffer.");
        } else if (data.URL) {
            // Get the rating of the package
            const secret = await getSecret(secretsManagerClient, "GitHubToken");
            const token = JSON.parse(secret) as { GitHubToken: string };
            rating = await getScores(token.GitHubToken, data.URL);

            // If the rating is less than 0.5, do not upload the package
            if (rating.NetScore < 0.5) {
                console.log('Package is not uploaded due to the disqualified rating of ', rating.NetScore);
                // return createErrorResponse(424, 'Package is not uploaded due to the disqualified rating.');
            }

            // Extract the version from the NPM url, if present
            // If a GitHub url is provided, the urlVersion will be empty
            const urlVersion: string = extractVersionFromNpmUrl(data.URL);
            console.log('URL version:', urlVersion);
            // If the version is provided in the URL, it must match the version in the metadata
            if (urlVersion && urlVersion != metadata.Version) {
                console.error(`Url version ${urlVersion} does not match the version in the metadata ${metadata.Version}.`);
                return createErrorResponse(400, 'Version in the URL does not match the version in the metadata.');
            }

            // Fetch the GitHub repository URL from the GitHub/NPM package url
            const repoUrl = await getRepoUrl(data.URL);
            if (!repoUrl) {
                console.error('Failed to fetch GitHub repository URL from npm package.');
                return createErrorResponse(400, 'Failed to fetch GitHub repository URL from npm package.');
            }
            // Clone the GitHub repository with the correct version and zip it
            fileContent = await cloneAndZipRepository(repoUrl, urlVersion);
            console.log("Cloned and zipped repository.");
        } else {
            return createErrorResponse(400, 'Invalid request. No valid content or URL provided.');
        }

        // Extract package.json and README.md from the zip file
        const packageJson = await extractPackageJsonFromZip(fileContent);
        const readme = await extractReadmeFromZip(fileContent);

        // Generate a unique ID for the package
        const packageId = generatePackageID(data.Name, metadata.Version);

        // upload readme to opensearch
        const new_metadata: PackageMetadata = {
            Name: metadata.Name,
            Version: metadata.Version,
            ID: packageId,
        };

        if (readme){
            // upload readme to opensearch
            console.log('Uploading readme to opensearch');
            await uploadToOpenSearch('readmes', readme, new_metadata);
            // don't upload to recommendation index to avoid multiple versions of the same package
            // being returned by the /recommend endpoint
            console.log('Uploaded readme to opensearch');
        }

        if (packageJson) {
            // upload package.json to opensearch
            console.log('Uploading package.json to opensearch');
            await uploadToOpenSearch('packagejsons', JSON.stringify(packageJson), new_metadata);
            console.log('Uploaded package.json to opensearch');
        }

        // Upload the package zip to S3
        if (data.debloat) {
            // Debloat the package content
            console.log('Debloating the package content.');
            fileContent = await debloatPackage(fileContent);
            console.log('Debloating complete.');
        }
        const s3Key = await uploadToS3(s3Client, fileContent, metadata.Name, metadata.Version);
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
            ...(rating && { Rating: rating }),
        };
        await uploadPackageMetadata(dynamoDBClient, row);

        // Log the package creation in the package history
        const user: User = {
            name: "ece30861defaultadminuser",
            isAdmin: true,
        };

        console.log('Updating package history.');
        await updatePackageHistory(dynamoDBClient, metadata.Name, metadata.Version, packageId, user, "UPDATE");
        console.log('Package history updated.');

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
            statusCode: 200,
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

export function extractVersionFromNpmUrl(url: string): string {
    const regex = /https:\/\/www\.npmjs\.com\/package\/([^/]+)(?:\/v\/([\d.]+))?/;
    const match = url.match(regex);
    return match ? match[2] : '';
}

export function isNewVersionValid(oldVersion: string, newVersion: string): boolean {
    // Split the versions into major, minor, and patch numbers
    const [oldMajor, oldMinor, oldPatch] = oldVersion.split('.').map(Number);
    const [newMajor, newMinor, newPatch] = newVersion.split('.').map(Number);

    // Validate the input versions
    if (
        [oldMajor, oldMinor, oldPatch, newMajor, newMinor, newPatch].some(
            (num) => isNaN(num) || num < 0
        )
    ) {
        console.error('Invalid version number format.');
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
