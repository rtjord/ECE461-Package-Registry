import {
    S3Client,
    PutObjectCommand,
    ListObjectsV2Command,
    DeleteObjectsCommand,
    ListObjectsV2CommandOutput,
    DeleteObjectCommand
} from "@aws-sdk/client-s3";

import { getEnvVariable } from "./utils";

export async function uploadToS3(s3Client: S3Client, fileContent: Buffer, packageName: string, version: string): Promise<string> {
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

// Delete the package file from S3
export async function deletePackageFromS3(client: S3Client, s3Key: string): Promise<void> {
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

// Function to empty an S3 bucket
export async function emptyS3Bucket(
    s3Client: S3Client,
    bucketName: string
): Promise<void> {
    console.log(`Emptying S3 bucket: ${bucketName}`);
    let continuationToken: string | undefined;

    do {
        const listObjects: ListObjectsV2CommandOutput = await s3Client.send(
            new ListObjectsV2Command({ Bucket: bucketName, ContinuationToken: continuationToken })
        );

        const objects = listObjects.Contents?.map((object) => ({ Key: object.Key })) || [];
        if (objects.length > 0) {
            console.log(`Deleting ${objects.length} objects from bucket: ${bucketName}`);
            await s3Client.send(
                new DeleteObjectsCommand({
                    Bucket: bucketName,
                    Delete: { Objects: objects },
                })
            );
        }

        continuationToken = listObjects.NextContinuationToken;
    } while (continuationToken);

    console.log(`Bucket ${bucketName} emptied successfully.`);
}