import * as fs from 'fs-extra';
import * as path from 'path';
import * as os from 'os';
import JSZip from 'jszip';
import { debloatPackage, cloneAndZipRepository, zipDirectory, extractPackageJsonFromZip, extractReadmeFromZip } from '../zip'; // Adjust the path

describe("File Operations and Compression Functions", () => {
    let tempDir: string;

    beforeAll(async () => {
        tempDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'jest-test-'));
    });

    afterAll(async () => {
        await fs.promises.rm(tempDir, { recursive: true, force: true });
    });

    describe("debloatPackage", () => {
        it("should optimize JavaScript and TypeScript files in a zip archive", async () => {
            const zip = new JSZip();
            zip.file("test.js", "console.log('hello world');");
            zip.file("test.txt", "This is a text file.");

            const zipBuffer = await zip.generateAsync({ type: 'nodebuffer' });
            const optimizedZipBuffer = await debloatPackage(zipBuffer);

            const optimizedZip = await JSZip.loadAsync(optimizedZipBuffer);
            const optimizedJs = await optimizedZip.file("test.js")?.async("string");
            const optimizedTxt = await optimizedZip.file("test.txt")?.async("string");

            expect(optimizedJs).not.toBeNull();
            expect(optimizedTxt).toBe("This is a text file.");
        });
    });

    describe("cloneAndZipRepository", () => {
        it("should clone a repository and zip it", async () => {
            const repoUrl = "https://github.com/isomorphic-git/isomorphic-git"; // Use a real repo URL
            const zipBuffer = await cloneAndZipRepository(repoUrl);

            const zip = await JSZip.loadAsync(zipBuffer);
            const files = Object.keys(zip.files);

            expect(files).toContain("README.md");
        });
    });

    describe("zipDirectory", () => {
        it("should create a zip archive from a directory", async () => {
            const testDir = path.join(tempDir, 'testDir');
            await fs.promises.mkdir(testDir);
            await fs.promises.writeFile(path.join(testDir, 'file1.txt'), "File 1 content");
            await fs.promises.writeFile(path.join(testDir, 'file2.txt'), "File 2 content");

            const zipBuffer = await zipDirectory(testDir);
            const zip = await JSZip.loadAsync(zipBuffer);

            const files = Object.keys(zip.files);
            expect(files).toContain("file1.txt");
            expect(files).toContain("file2.txt");
        });
    });

    describe("extractPackageJsonFromZip", () => {
        it("should extract package.json from a zip archive", async () => {
            const zip = new JSZip();
            zip.file("package.json", JSON.stringify({ name: "test-package", version: "1.0.0" }));

            const zipBuffer = await zip.generateAsync({ type: 'nodebuffer' });
            const packageJson = await extractPackageJsonFromZip(zipBuffer);

            expect(packageJson).toBeTruthy();
            expect(JSON.parse(packageJson!)).toEqual({ name: "test-package", version: "1.0.0" });
        });

        it("should return null if package.json is not present", async () => {
            const zip = new JSZip();
            const zipBuffer = await zip.generateAsync({ type: 'nodebuffer' });

            const packageJson = await extractPackageJsonFromZip(zipBuffer);
            expect(packageJson).toBeNull();
        });
    });

    describe("extractReadmeFromZip", () => {
        it("should extract README.md from a zip archive", async () => {
            const zip = new JSZip();
            zip.file("README.md", "This is a readme file.");

            const zipBuffer = await zip.generateAsync({ type: 'nodebuffer' });
            const readme = await extractReadmeFromZip(zipBuffer);

            expect(readme).toBe("This is a readme file.");
        });

        it("should return null if README.md is not present", async () => {
            const zip = new JSZip();
            const zipBuffer = await zip.generateAsync({ type: 'nodebuffer' });

            const readme = await extractReadmeFromZip(zipBuffer);
            expect(readme).toBeNull();
        });
    });
});
