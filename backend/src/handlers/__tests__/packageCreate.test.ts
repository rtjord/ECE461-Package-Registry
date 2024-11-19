import { getPackageById } from '../PackageCreate/utils';
import * as utils from '../PackageCreate/utils';
import { handler, generatePackageID, extractFilesFromZip, extractVersionFromPackageJson } from '../PackageCreate/index';
import { createErrorResponse } from '../PackageCreate/utils';
import JSZip from 'jszip';
import { Package, PackageTableRow } from '../PackageCreate/interfaces';

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

describe('extractMetadataFromPackageJson', () => {
    it('should extract name and version from valid package.json', () => {
        const packageJson = JSON.stringify({
            name: 'test-package',
            version: '1.0.0',
        });
        const metadata = extractVersionFromPackageJson(packageJson);
        expect(metadata).toEqual({ packageName: 'test-package', version: '1.0.0' });
    });

    it('should return null for name or version if missing', () => {
        const packageJson = JSON.stringify({});
        const metadata = extractVersionFromPackageJson(packageJson);
        expect(metadata).toEqual({ packageName: null, version: null });
    });
});

describe('handler', () => {
    it('should return an error if no body is present', async () => {
        const event = { body: null } as any;
        const result = await handler(event);
        expect(result).toEqual(createErrorResponse(400, 'Request body is missing.'));
    });

    it('should return an error if both Content and URL are provided', async () => {
        const event = {
            body: JSON.stringify({ Content: 'fakeContent', URL: 'http://example.com' }),
        } as any;
        const result = await handler(event);
        expect(result).toEqual(createErrorResponse(400, 'Exactly one of Content or URL must be provided.'));
    });

    it('should return an error if package.json is missing in the zip', async () => {
        const mockZipBuffer = Buffer.from('test');
        const event = {
            body: JSON.stringify({ Content: mockZipBuffer.toString('base64') }),
        } as any;

        jest.spyOn(JSZip, 'loadAsync').mockResolvedValue({
            file: jest.fn().mockReturnValue([]),
        } as any);

        const result = await handler(event);
        expect(result).toEqual(createErrorResponse(400, 'package.json not found in the uploaded zip file.'));
    });
});
