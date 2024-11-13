import { S3 } from '@aws-sdk/client-s3';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, PutCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { createErrorResponse, getPackageById } from './utils';
import { PackageData, PackageTableRow } from './interfaces';
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

    const packageJsonFile = contents.file("package.json");
    const packageJsonContent = packageJsonFile ? await packageJsonFile.async("string") : null;

    const readmeFile = contents.file("README.md");
    const readmeContent = readmeFile ? await readmeFile.async("string") : null;


    const gitConfigFile = contents.file(".git/config");
    const gitConfigContent = gitConfigFile ? await gitConfigFile.async("string") : null;

    let repoUrl: string | null = null;

    if (gitConfigContent) {
        const match = gitConfigContent.match(/url = (.+)/);
        repoUrl = match ? match[1].trim() : null;
    }

    return {
      packageJson: packageJsonContent,
      readme: readmeContent,
      repoUrl: repoUrl,
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
    const s3Params = {
        Bucket: process.env.S3_BUCKET_NAME!,
        Key: s3Key,
        Body: fileContent,
        ContentType: 'application/zip',
    };

    await s3.putObject(s3Params);
    return `https://${s3Params.Bucket}.s3.amazonaws.com/${s3Params.Key}`;
}

async function savePackageMetadataToDynamoDB(
    packageId: string, packageName: string, version: string, fileUrl: string | null, fileSizeInMB: number
) {
    const dynamoDBParams = {
        TableName: process.env.PACKAGE_TABLE_NAME!,
        Item: {
            PackageName: packageName,
            Version: version,
            ID: packageId,
            URL: fileUrl,
            s3Key: `uploads/${packageName}-${version}.zip`,
            standaloneCost: fileSizeInMB,
        },
    };

    await dynamoDBClient.send(new PutCommand(dynamoDBParams));
}

async function logPackageHistory(
    packageName: string, version: string, packageId: string, user: string
) {
    const historyEntry = {
        User: user,
        Date: new Date().toISOString(),
        PackageMetadata: {
            Name: packageName,
            Version: version,
            ID: packageId,
        },
        Action: 'CREATE',
    };

    const historyUpdateParams = {
        TableName: process.env.PACKAGE_HISTORY_TABLE_NAME!,
        Key: { PackageName: packageName },
        UpdateExpression: 'SET history = list_append(if_not_exists(history, :emptyList), :newEvent)',
        ExpressionAttributeValues: {
            ':newEvent': [historyEntry],
            ':emptyList': [],
        },
    };

    await dynamoDBClient.send(new UpdateCommand(historyUpdateParams));
}

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
    try {
        if (!event.body) {
            return createErrorResponse(400, 'Request body is missing.');
        }

        const requestBody: PackageData = JSON.parse(event.body);

        if ((!requestBody.Content && !requestBody.URL) || (requestBody.Content && requestBody.URL)) {
            return createErrorResponse(400, 'Exactly one of Content or URL must be provided.');
        }

        let packageName: string | null = null;
        let version: string | null = null;
        let fileUrl: string | null = null;
        let fileSizeInMB = 0;
        let repoUrl: string | null = null;
        if (requestBody.Content) {
            const fileContent = Buffer.from(requestBody.Content, 'base64');
            const { packageJson, readme, repoUrl } = await extractFilesFromZip(fileContent);
            const { packageJson } = await extractFilesFromZip(fileContent);
            if (!packageJson) {
                return createErrorResponse(400, 'package.json not found in the uploaded zip file.');
            }

            const metadata = extractMetadataFromPackageJson(packageJson);
            packageName = metadata.packageName;
            version = metadata.version;
            if (!packageName || !version) {
                return createErrorResponse(400, 'Package name or version could not be determined.');
            }

            fileSizeInMB = fileContent.length / (1024 * 1024);
            fileUrl = await uploadToS3(fileContent, packageName, version);
        } else if (requestBody.URL) {
            fileUrl = requestBody.URL;
            repoUrl = null;
            // Logic to fetch packageName and version if needed from URL (e.g., cloning a repo)
        }

        if (!packageName || !version) {
            return createErrorResponse(400, 'Package name or version could not be determined.');
        }

        const packageId = generatePackageID(packageName, version);
        const existingPackage: PackageTableRow | null = await getPackageById(packageId);
        if (existingPackage) {
            return createErrorResponse(409, 'Package already exists.');
        }

        await savePackageMetadataToDynamoDB(packageId, packageName, version, fileUrl, fileSizeInMB);

        const user = event.requestContext.authorizer?.principalId ?? "anonymous";
        await logPackageHistory(packageName, version, packageId, user);

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
                    repoUrl: repoUrl,
                },
                data: {
                    Content: fileUrl,
                },
            }),
        };

    } catch (error) {
        console.error("Error during POST package:", error);
        return {
            statusCode: 500,
            headers: {
                'Access-Control-Allow-Origin': '*',
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ message: 'Failed to upload package.', error: (error as Error).message }),
        };
    }
};
