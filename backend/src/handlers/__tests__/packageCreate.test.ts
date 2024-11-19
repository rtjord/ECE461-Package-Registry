import { handler, generatePackageID, extractFilesFromZip } from '../PackageCreate/index';
import { createErrorResponse } from '../../future_lambda_layer/utils';
import { APIGatewayProxyEvent } from 'aws-lambda';
import JSZip from 'jszip';

describe('generatePackageID', () => {
    it('should generate an 20 character ID for the package', () => {
        const name = 'test-package';
        const version = '1.0.0';
        const id = generatePackageID(name, version);
        expect(id).toHaveLength(20);
    });
    it('should generate the same ID for the same package', () => {
        const name = 'test-package';
        const version = '1.0.0';
        const id1 = generatePackageID(name, version);
        const id2 = generatePackageID(name, version);
        expect(id1).toEqual(id2);
    });
});

describe("extractFilesFromZip", () => {
    let zipBuffer: Buffer;

    beforeAll(async () => {
        // Create a mock ZIP file using JSZip
        const zip = new JSZip();
        zip.file("package.json", JSON.stringify({ name: "test-package", version: "1.0.0" }));
        zip.file("README.md", "# Test Package\nThis is a test README file.");

        // Generate a buffer from the ZIP file
        zipBuffer = await zip.generateAsync({ type: "nodebuffer" });
    });

    it("should extract package.json and README.md from the ZIP buffer", async () => {
        const result = await extractFilesFromZip(zipBuffer);

        // Validate extracted package.json
        expect(result.packageJson).toBe(
            JSON.stringify({ name: "test-package", version: "1.0.0" })
        );

        // Validate extracted README.md
        expect(result.readme).toBe("# Test Package\nThis is a test README file.");
    });

    it("should return null for missing files in the ZIP buffer", async () => {
        // Create a ZIP without the target files
        const zip = new JSZip();
        zip.file("otherfile.txt", "This is another file.");
        const emptyZipBuffer = await zip.generateAsync({ type: "nodebuffer" });

        const result = await extractFilesFromZip(emptyZipBuffer);

        // Validate that both files are null
        expect(result.packageJson).toBeNull();
        expect(result.readme).toBeNull();
    });
});


describe('handler', () => {
    it('should return an error if no body is present', async () => {
        const event = { body: null } as APIGatewayProxyEvent;
        const result = await handler(event);
        expect(result).toEqual(createErrorResponse(400, 'Request body is missing.'));
    });

    it('should return an error if both Content and URL are provided', async () => {
        const event = {
            body: JSON.stringify({ Content: 'fakeContent', URL: 'http://example.com' }),
        } as APIGatewayProxyEvent;
        const result = await handler(event);
        expect(result).toEqual(createErrorResponse(400, 'Exactly one of Content or URL must be provided.'));
    });
});
