import axios from "axios";
import { Package, PackageData, PackageMetadata } from "../../../future_lambda_layer/interfaces";
import { baseUrl } from "./config";


const timeout = 30000;

describe("E2E Test for Package Create Endpoint", () => {
    let content_id: string;
    let url_id: string;
    beforeAll(async () => {
        // Reset the registry before running the tests
        await axios.delete(`${baseUrl}/reset`);

        // Upload a package with Content to the registry
        const requestBody: PackageData = {
            Name: "test-package",
            Content: "UEsDBBQAAAAAAKm8clkAAAAAAAAAAAAAAAATACAAdGVzdC1wYWNrYWdlLTEuMC4wL1VUDQAH/xU8Z18WPGfcFTxndXgLAAEEAAAAAAQAAAAAUEsDBBQACAAIAJy8clkAAAAAAAAAAAQBAAAfACAAdGVzdC1wYWNrYWdlLTEuMC4wL3BhY2thZ2UuanNvblVUDQAH6BU8ZwAWPGfiFTxndXgLAAEEAAAAAAQAAAAAXc89D4IwEAbgnYT/cLmBSQmsbMY4OOvI0pRTTqVtetWQGP67lK/Bbten7+XtN01gPGhUR1gBBpKwd0o/1Z1wt+CHvLA10cu8yIsNGhLt2YUFr2MY/sOd4gnZNNTnD9lgjspoS4npNhaIz0m3Fmo8eW99BcZCBBBHmm9MTY2QZUA9Byhxjg/rYvUOrfVbocM8rvpiTUamz54vR0yT4QdQSwcI9J0+op4AAAAEAQAAUEsDBBQACAAIALW8clkAAAAAAAAAACoAAAAcACAAdGVzdC1wYWNrYWdlLTEuMC4wL1JFQURNRS5tZFVUDQAHFhY8ZxYWPGf/FTxndXgLAAEEAAAAAAQAAAAAC3J1dPF1VUjLzElVSMsvUihJLS7RLUhMzk5MT1UoSy0qzszPUzDUM9AzAABQSwcI8eDIMywAAAAqAAAAUEsBAhQDFAAAAAAAqbxyWQAAAAAAAAAAAAAAABMAIAAAAAAAAAAAAP9BAAAAAHRlc3QtcGFja2FnZS0xLjAuMC9VVA0AB/8VPGdfFjxn3BU8Z3V4CwABBAAAAAAEAAAAAFBLAQIUAxQACAAIAJy8cln0nT6ingAAAAQBAAAfACAAAAAAAAAAAAC2gVEAAAB0ZXN0LXBhY2thZ2UtMS4wLjAvcGFja2FnZS5qc29uVVQNAAfoFTxnABY8Z+IVPGd1eAsAAQQAAAAABAAAAABQSwECFAMUAAgACAC1vHJZ8eDIMywAAAAqAAAAHAAgAAAAAAAAAAAAtoFcAQAAdGVzdC1wYWNrYWdlLTEuMC4wL1JFQURNRS5tZFVUDQAHFhY8ZxYWPGf/FTxndXgLAAEEAAAAAAQAAAAAUEsFBgAAAAADAAMAOAEAAPIBAAAAAA==",
            debloat: false,
            JSProgram: "console.log('Hello, World!');",
        };

        const response = await axios.post(`${baseUrl}/package`, requestBody);

        // Get the ID of the uploaded package
        content_id = response.data.metadata.ID;

        // Upload a package with a URL to the registry
        const requestBody2: PackageData = {
            Name: "yazl",
            URL: "https://www.npmjs.com/package/yazl/v/3.1.0",
            debloat: false,
        };

        const response2 = await axios.post(`${baseUrl}/package`, requestBody2);
        // Get the ID of the uploaded package
        url_id = response2.data.metadata.ID;

    }, 60000);
    afterAll(async () => {
        // Reset the registry after running the tests
        await axios.delete(`${baseUrl}/reset`);
    }, timeout);
    it("should return a 200 status for a package with Content set", async () => {
        const requestBody: Package = {
            metadata: {
                Name: "test-package",
                Version: "1.0.1",
                ID: content_id,
            },
            data: {
                Name: "test-package",
                Content: "UEsDBBQAAAAAALm8clkAAAAAAAAAAAAAAAATACAAdGVzdC1wYWNrYWdlLTEuMC4xL1VUDQAHHxY8Z2UWPGcfFjxndXgLAAEEAAAAAAQAAAAAUEsDBBQACAAIAMa8clkAAAAAAAAAAAQBAAAfACAAdGVzdC1wYWNrYWdlLTEuMC4xL3BhY2thZ2UuanNvblVUDQAHNBY8ZzYWPGcfFjxndXgLAAEEAAAAAAQAAAAAXc89D4IwEAbgnYT/cLmBSYmsbMY4OOPI0pRTTqUlvWpIDP/dlq/Bbten7+XtN00gHDSqIywBPYnf90o/1Z1wt+CHnLA10Yv8kBcbNCTace8XvIYw/Ic7xROyaWjIH7LBHJVgS4npNhaIz0m3Fmo8O2ddCcZCBJCeNN+Ymhohy4AG9lDgHB/XxertW+u2Qsd5XPXFmoxMn71UJ0yT8QdQSwcIu0AVyp4AAAAEAQAAUEsDBBQACAAIAMi8clkAAAAAAAAAACoAAAAcACAAdGVzdC1wYWNrYWdlLTEuMC4xL1JFQURNRS5tZFVUDQAHOBY8ZzkWPGcfFjxndXgLAAEEAAAAAAQAAAAAC3J1dPF1VUjLzElVSMsvUihJLS7RLUhMzk5MT1UoSy0qzszPUzDUM9AzBABQSwcIZ9DPRCwAAAAqAAAAUEsBAhQDFAAAAAAAubxyWQAAAAAAAAAAAAAAABMAIAAAAAAAAAAAAP9BAAAAAHRlc3QtcGFja2FnZS0xLjAuMS9VVA0ABx8WPGdlFjxnHxY8Z3V4CwABBAAAAAAEAAAAAFBLAQIUAxQACAAIAMa8clm7QBXKngAAAAQBAAAfACAAAAAAAAAAAAC2gVEAAAB0ZXN0LXBhY2thZ2UtMS4wLjEvcGFja2FnZS5qc29uVVQNAAc0FjxnNhY8Zx8WPGd1eAsAAQQAAAAABAAAAABQSwECFAMUAAgACADIvHJZZ9DPRCwAAAAqAAAAHAAgAAAAAAAAAAAAtoFcAQAAdGVzdC1wYWNrYWdlLTEuMC4xL1JFQURNRS5tZFVUDQAHOBY8ZzkWPGcfFjxndXgLAAEEAAAAAAQAAAAAUEsFBgAAAAADAAMAOAEAAPIBAAAAAA==",
                debloat: false,
                JSProgram: "console.log('Hello, World!');",
            },
        };

        const response = await axios.post(`${baseUrl}/package/${content_id}`, requestBody);
        expect(response.status).toBe(200);

        // expect response.data to be of type Package
        const packageObject: Package = response.data;

        const metadata: PackageMetadata = packageObject.metadata;
        expect(metadata).toHaveProperty("Name", "test-package");
        expect(metadata).toHaveProperty("Version", "1.0.1");
        expect(metadata).toHaveProperty("ID");
        expect(metadata.ID).not.toBe(content_id);  // The id should not be the same as the original content_id

        const data: PackageData = packageObject.data;
        expect(data).toHaveProperty("Name", "test-package");
        expect(data).toHaveProperty("Content", requestBody.data.Content);
    }, timeout);
    it("should return a 200 status when uploading a package with a URL", async () => {
        const requestBody: Package = {
            metadata: {
                Name: "yazl",
                Version: "3.2.0",
                ID: url_id,
            },
            data: {
                Name: "yazl",
                URL: "https://www.npmjs.com/package/yazl/v/3.2.0",
            },
        };

        const response = await axios.post(`${baseUrl}/package/${url_id}`, requestBody);
        expect(response.status).toBe(200);

        // expect response.data to be of type Package
        const packageObject: Package = response.data;

        const metadata: PackageMetadata = packageObject.metadata;
        expect(metadata).toHaveProperty("Name", "yazl");
        expect(metadata).toHaveProperty("Version", "3.2.0");
        expect(metadata).toHaveProperty("ID");
        expect(metadata.ID).not.toBe(url_id);  // The id should not be the same as the original content_id

        const data: PackageData = packageObject.data;
        expect(data).toHaveProperty("Name", "yazl");
        expect(data).toHaveProperty("URL", "https://www.npmjs.com/package/yazl/v/3.2.0");
    }, timeout);
    it("should return a 400 status when uploading a package without Content or URL", async () => {
        const requestBody: Package = {
            metadata: {
                Name: "test-package",
                Version: "1.0.2",
                ID: content_id,
            },
            data: {
                Name: "test-package",
            },
        };

        try {
            await axios.post(`${baseUrl}/package/${content_id}`, requestBody);
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
        const requestBody: Package = {
            metadata: {
                Name: "test-package",
                Version: "1.0.2",
                ID: content_id,
            },
            data: {
                Name: "test-package",
                Content: "UEsDBBQAAAAAALm8clkAAAAAAAAAAAAAAAATACAAdGVzdC1wYWNrYWdlLTEuMC4xL1VUDQAHHxY8Z2UWPGcfFjxndXgLAAEEAAAAAAQAAAAAUEsDBBQACAAIAMa8clkAAAAAAAAAAAQBAAAfACAAdGVzdC1wYWNrYWdlLTEuMC4xL3BhY2thZ2UuanNvblVUDQAHNBY8ZzYWPGcfFjxndXgLAAEEAAAAAAQAAAAAXc89D4IwEAbgnYT/cLmBSYmsbMY4OOPI0pRTTqUlvWpIDP/dlq/Bbten7+XtN00gHDSqIywBPYnf90o/1Z1wt+CHnLA10Yv8kBcbNCTace8XvIYw/Ic7xROyaWjIH7LBHJVgS4npNhaIz0m3Fmo8O2ddCcZCBJCeNN+Ymhohy4AG9lDgHB/XxertW+u2Qsd5XPXFmoxMn71UJ0yT8QdQSwcIu0AVyp4AAAAEAQAAUEsDBBQACAAIAMi8clkAAAAAAAAAACoAAAAcACAAdGVzdC1wYWNrYWdlLTEuMC4xL1JFQURNRS5tZFVUDQAHOBY8ZzkWPGcfFjxndXgLAAEEAAAAAAQAAAAAC3J1dPF1VUjLzElVSMsvUihJLS7RLUhMzk5MT1UoSy0qzszPUzDUM9AzBABQSwcIZ9DPRCwAAAAqAAAAUEsBAhQDFAAAAAAAubxyWQAAAAAAAAAAAAAAABMAIAAAAAAAAAAAAP9BAAAAAHRlc3QtcGFja2FnZS0xLjAuMS9VVA0ABx8WPGdlFjxnHxY8Z3V4CwABBAAAAAAEAAAAAFBLAQIUAxQACAAIAMa8clm7QBXKngAAAAQBAAAfACAAAAAAAAAAAAC2gVEAAAB0ZXN0LXBhY2thZ2UtMS4wLjEvcGFja2FnZS5qc29uVVQNAAc0FjxnNhY8Zx8WPGd1eAsAAQQAAAAABAAAAABQSwECFAMUAAgACADIvHJZZ9DPRCwAAAAqAAAAHAAgAAAAAAAAAAAAtoFcAQAAdGVzdC1wYWNrYWdlLTEuMC4xL1JFQURNRS5tZFVUDQAHOBY8ZzkWPGcfFjxndXgLAAEEAAAAAAQAAAAAUEsFBgAAAAADAAMAOAEAAPIBAAAAAA==",
                URL: "https://www.npmjs.com/package/yazl/v/3.2.0",
            },
        };

        try {
            await axios.post(`${baseUrl}/package/${content_id}`, requestBody);
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
    it("should return a 404 status if no package with that ID exists", async () => {
        const requestBody: Package = {
            metadata: {
                Name: "test-package",
                Version: "1.0.2",
                ID: "non-existent-id",
            },
            data: {
                Name: "test-package",
                Content: "UEsDBBQAAAAAALm8clkAAAAAAAAAAAAAAAATACAAdGVzdC1wYWNrYWdlLTEuMC4xL1VUDQAHHxY8Z2UWPGcfFjxndXgLAAEEAAAAAAQAAAAAUEsDBBQACAAIAMa8clkAAAAAAAAAAAQBAAAfACAAdGVzdC1wYWNrYWdlLTEuMC4xL3BhY2thZ2UuanNvblVUDQAHNBY8ZzYWPGcfFjxndXgLAAEEAAAAAAQAAAAAXc89D4IwEAbgnYT/cLmBSYmsbMY4OOPI0pRTTqUlvWpIDP/dlq/Bbten7+XtN00gHDSqIywBPYnf90o/1Z1wt+CHnLA10Yv8kBcbNCTace8XvIYw/Ic7xROyaWjIH7LBHJVgS4npNhaIz0m3Fmo8O2ddCcZCBJCeNN+Ymhohy4AG9lDgHB/XxertW+u2Qsd5XPXFmoxMn71UJ0yT8QdQSwcIu0AVyp4AAAAEAQAAUEsDBBQACAAIAMi8clkAAAAAAAAAACoAAAAcACAAdGVzdC1wYWNrYWdlLTEuMC4xL1JFQURNRS5tZFVUDQAHOBY8ZzkWPGcfFjxndXgLAAEEAAAAAAQAAAAAC3J1dPF1VUjLzElVSMsvUihJLS7RLUhMzk5MT1UoSy0qzszPUzDUM9AzBABQSwcIZ9DPRCwAAAAqAAAAUEsBAhQDFAAAAAAAubxyWQAAAAAAAAAAAAAAABMAIAAAAAAAAAAAAP9BAAAAAHRlc3QtcGFja2FnZS0xLjAuMS9VVA0ABx8WPGdlFjxnHxY8Z3V4CwABBAAAAAAEAAAAAFBLAQIUAxQACAAIAMa8clm7QBXKngAAAAQBAAAfACAAAAAAAAAAAAC2gVEAAAB0ZXN0LXBhY2thZ2UtMS4wLjEvcGFja2FnZS5qc29uVVQNAAc0FjxnNhY8Zx8WPGd1eAsAAQQAAAAABAAAAABQSwECFAMUAAgACADIvHJZZ9DPRCwAAAAqAAAAHAAgAAAAAAAAAAAAtoFcAQAAdGVzdC1wYWNrYWdlLTEuMC4xL1JFQURNRS5tZFVUDQAHOBY8ZzkWPGcfFjxndXgLAAEEAAAAAAQAAAAAUEsFBgAAAAADAAMAOAEAAPIBAAAAAA==",
            },
        };

        try {
            await axios.post(`${baseUrl}/package/non-existent-id`, requestBody);
        } catch (error) {
            if (!axios.isAxiosError(error)) {
                throw error;
            }

            const response = error.response;
            if (!response) {
                throw error;
            }

            expect(response.status).toBe(404);
        }
    }, timeout);
});