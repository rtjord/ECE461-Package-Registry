import axios from "axios";
import { Package, PackageData, PackageMetadata } from "../../../future_lambda_layer/interfaces";

const baseUrl = "http://127.0.0.1:3000";
const timeout = 10000;

describe("E2E Test for Package Create Endpoint", () => {
    const content = "UEsDBBQAAAAAAKm8clkAAAAAAAAAAAAAAAATACAAdGVzdC1wYWNrYWdlLTEuMC4wL1VUDQAH/xU8Z18WPGfcFTxndXgLAAEEAAAAAAQAAAAAUEsDBBQACAAIAJy8clkAAAAAAAAAAAQBAAAfACAAdGVzdC1wYWNrYWdlLTEuMC4wL3BhY2thZ2UuanNvblVUDQAH6BU8ZwAWPGfiFTxndXgLAAEEAAAAAAQAAAAAXc89D4IwEAbgnYT/cLmBSQmsbMY4OOvI0pRTTqVtetWQGP67lK/Bbten7+XtN01gPGhUR1gBBpKwd0o/1Z1wt+CHvLA10cu8yIsNGhLt2YUFr2MY/sOd4gnZNNTnD9lgjspoS4npNhaIz0m3Fmo8eW99BcZCBBBHmm9MTY2QZUA9Byhxjg/rYvUOrfVbocM8rvpiTUamz54vR0yT4QdQSwcI9J0+op4AAAAEAQAAUEsDBBQACAAIALW8clkAAAAAAAAAACoAAAAcACAAdGVzdC1wYWNrYWdlLTEuMC4wL1JFQURNRS5tZFVUDQAHFhY8ZxYWPGf/FTxndXgLAAEEAAAAAAQAAAAAC3J1dPF1VUjLzElVSMsvUihJLS7RLUhMzk5MT1UoSy0qzszPUzDUM9AzAABQSwcI8eDIMywAAAAqAAAAUEsBAhQDFAAAAAAAqbxyWQAAAAAAAAAAAAAAABMAIAAAAAAAAAAAAP9BAAAAAHRlc3QtcGFja2FnZS0xLjAuMC9VVA0AB/8VPGdfFjxn3BU8Z3V4CwABBAAAAAAEAAAAAFBLAQIUAxQACAAIAJy8cln0nT6ingAAAAQBAAAfACAAAAAAAAAAAAC2gVEAAAB0ZXN0LXBhY2thZ2UtMS4wLjAvcGFja2FnZS5qc29uVVQNAAfoFTxnABY8Z+IVPGd1eAsAAQQAAAAABAAAAABQSwECFAMUAAgACAC1vHJZ8eDIMywAAAAqAAAAHAAgAAAAAAAAAAAAtoFcAQAAdGVzdC1wYWNrYWdlLTEuMC4wL1JFQURNRS5tZFVUDQAHFhY8ZxYWPGf/FTxndXgLAAEEAAAAAAQAAAAAUEsFBgAAAAADAAMAOAEAAPIBAAAAAA==";

    beforeAll(async () => {
        // Reset the registry before running the tests
        await axios.delete(`${baseUrl}/reset`);
    });
    afterAll(async () => {
        // Reset the registry after running the tests
        await axios.delete(`${baseUrl}/reset`);
    });
    it("should return a 201 status for a package with Content set", async () => {
        const requestBody: PackageData = {
            Name: "test-package",
            Content: content,
            debloat: false,
            JSProgram: "console.log('Hello, World!');",
        };

        const response = await axios.post(`${baseUrl}/package`, requestBody);
        expect(response.status).toBe(201);

        // expect response.data to be of type Package
        const packageObject: Package = response.data;

        const metadata: PackageMetadata = packageObject.metadata;
        expect(metadata).toHaveProperty("Name", "test-package");
        expect(metadata).toHaveProperty("Version", "1.0.0");
        expect(metadata).toHaveProperty("ID");

        const data: PackageData = packageObject.data;
        expect(data).toHaveProperty("Name", "test-package");
        expect(data).toHaveProperty("Content", content);
    }, timeout);
    it("should return a 201 status when uploading a package with a URL", async () => {
        const requestBody: PackageData = {
            Name: "yazl",
            URL: "https://www.npmjs.com/package/yazl/v/3.1.0",
            debloat: false,
        };

        const response = await axios.post(`${baseUrl}/package`, requestBody);
        expect(response.status).toBe(201);

        // expect response.data to be of type Package
        const packageObject: Package = response.data;

        const metadata: PackageMetadata = packageObject.metadata;
        expect(metadata).toHaveProperty("Name", "yazl");
        expect(metadata).toHaveProperty("Version", "3.1.0");
        expect(metadata).toHaveProperty("ID");

        const data: PackageData = packageObject.data;
        expect(data).toHaveProperty("Name", "yazl");
        expect(data).toHaveProperty("URL", "https://www.npmjs.com/package/yazl/v/3.1.0");
    }, timeout);
    it("should return a 400 status when uploading a package without Content or URL", async () => {
        const requestBody: PackageData = {
            Name: "package-without-content-or-url",
        };

        try {
            await axios.post(`${baseUrl}/package`, requestBody);
        } catch (error) {
            if (!axios.isAxiosError(error)) {
                throw error;
            }

            const response = error.response;
            if (!response) {
                throw error;
            }

            expect(response.status).toBe(400);
        }
    }, timeout);
    it("should return a 400 status if both Content or URL are set", async () => {
        const requestBody: PackageData = {
            Name: "package-with-content-and-url",
            Content: content,
            URL: "https://www.npmjs.com/package/yazl/v/3.1.0",
        };

        try {
            await axios.post(`${baseUrl}/package`, requestBody);
        } catch (error) {
            if (!axios.isAxiosError(error)) {
                throw error;
            }

            const response = error.response;
            if (!response) {
                throw error;
            }

            expect(response.status).toBe(400);
        }
    }, timeout);
    it("should return a 409 status when uploading a package with the same name", async () => {
        const requestBody: PackageData = {
            Name: "test-package",
            Content: content,
            debloat: false,
            JSProgram: "console.log('Hello, World!');",
        };

        try {
            await axios.post(`${baseUrl}/package`, requestBody);
        } catch (error) {
            if (!axios.isAxiosError(error)) {
                throw error;
            }

            const response = error.response;
            if (!response) {
                throw error;
            }

            expect(response.status).toBe(409);
        }
    }, timeout);
});