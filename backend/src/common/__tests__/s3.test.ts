import {
    S3Client,
    ListObjectsV2Command,
    DeleteObjectCommand,
    PutObjectCommand,
} from "@aws-sdk/client-s3";
import {
    uploadToS3,
    deletePackageFromS3,
    emptyS3Bucket
} from "../s3"; // Adjust path to your file
import { fromIni, fromNodeProviderChain } from "@aws-sdk/credential-providers";


describe("S3 Operations", () => {
    let s3Client: S3Client;
    process.env.S3_BUCKET_NAME = "package-files-dev";
    const bucketName = process.env.S3_BUCKET_NAME!;
    const testFileContent = Buffer.from("This is a test file.");
    const testPackageName = "test-package";
    const testVersion = "1.0.0";
    const isGitHub = process.env.GITHUB_ACTIONS === "true";

    beforeAll(() => {
        if (!bucketName) {
            throw new Error("Environment variable S3_BUCKET_NAME is not defined.");
        }

        s3Client = new S3Client({
            region: "us-east-2", credentials: isGitHub
                ? fromNodeProviderChain() // Use default credentials in GitHub Actions
                : fromIni({ profile: "dev" }),
        });
    });

    describe("uploadToS3", () => {
        it("should upload a file to S3 and return the S3 key", async () => {
            const s3Key = await uploadToS3(s3Client, testFileContent, testPackageName, testVersion);

            // Verify the object exists in S3
            const listObjects = await s3Client.send(new ListObjectsV2Command({ Bucket: bucketName }));
            const uploadedObject = listObjects.Contents?.find((obj) => obj.Key === s3Key);

            expect(uploadedObject).toBeDefined();
            expect(uploadedObject?.Key).toBe(s3Key);

            // Clean up the uploaded object
            await s3Client.send(new DeleteObjectCommand({ Bucket: bucketName, Key: s3Key }));
        });
    });

    describe("deletePackageFromS3", () => {
        it("should delete a file from S3", async () => {
            const s3Key = await uploadToS3(s3Client, testFileContent, testPackageName, testVersion);

            // Verify the object exists before deletion
            let listObjects = await s3Client.send(new ListObjectsV2Command({ Bucket: bucketName }));
            let uploadedObject = listObjects.Contents?.find((obj) => obj.Key === s3Key);
            expect(uploadedObject).toBeDefined();

            // Delete the object
            await deletePackageFromS3(s3Client, s3Key);

            // Verify the object no longer exists
            listObjects = await s3Client.send(new ListObjectsV2Command({ Bucket: bucketName }));
            uploadedObject = listObjects.Contents?.find((obj) => obj.Key === s3Key);
            expect(uploadedObject).toBeUndefined();
        });

        it("should throw an error if the S3 key is not provided", async () => {
            await expect(deletePackageFromS3(s3Client, "")).rejects.toThrow("S3 key not provided for deletion.");
        });
    });

    describe("emptyS3Bucket", () => {
        it("should empty the S3 bucket", async () => {
            const keysToUpload = ["file1.txt", "file2.txt", "file3.txt"];

            // Upload test files
            for (const key of keysToUpload) {
                await s3Client.send(new PutObjectCommand({
                    Bucket: bucketName,
                    Key: key,
                    Body: `Content of ${key}`,
                }));
            }

            // Verify files are uploaded
            let listObjects = await s3Client.send(new ListObjectsV2Command({ Bucket: bucketName }));
            expect(listObjects.Contents?.length).toBeGreaterThan(0);

            // Empty the bucket
            await emptyS3Bucket(s3Client, bucketName);

            // Verify the bucket is empty
            listObjects = await s3Client.send(new ListObjectsV2Command({ Bucket: bucketName }));
            expect(listObjects.Contents).toBeUndefined();
            // expect(listObjects.Contents?.length).toBe(0);
        });
    });
});
