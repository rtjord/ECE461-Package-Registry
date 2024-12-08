import axios from "axios";
import { PackageData, Package, PackageMetadata, PackageQuery, EnumerateOffset } from "../../../common/interfaces";
import { baseUrl } from "./config";


const timeout = 30000;

describe("E2E Test for Packages List Endpoint", () => {
    const ids: string[] = [];
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

        const first_id: string = response.data.metadata.ID;
        // Append the ID of the uploaded package
        ids.push(first_id);

        const version_list = ["1.0.1", "1.0.2", "1.0.3", "2.0.0", "1.2.0", "1.1.0"];
        // Upload multiple versions of the package
        for (const version of version_list) {
            const requestBody: Package = {
                metadata: {
                    Name: "test-package",
                    Version: version,
                    ID: first_id,
                },
                data: {
                    Name: "test-package",
                    Content: "UEsDBBQAAAAAALm8clkAAAAAAAAAAAAAAAATACAAdGVzdC1wYWNrYWdlLTEuMC4xL1VUDQAHHxY8Z2UWPGcfFjxndXgLAAEEAAAAAAQAAAAAUEsDBBQACAAIAMa8clkAAAAAAAAAAAQBAAAfACAAdGVzdC1wYWNrYWdlLTEuMC4xL3BhY2thZ2UuanNvblVUDQAHNBY8ZzYWPGcfFjxndXgLAAEEAAAAAAQAAAAAXc89D4IwEAbgnYT/cLmBSYmsbMY4OOPI0pRTTqUlvWpIDP/dlq/Bbten7+XtN00gHDSqIywBPYnf90o/1Z1wt+CHnLA10Yv8kBcbNCTace8XvIYw/Ic7xROyaWjIH7LBHJVgS4npNhaIz0m3Fmo8O2ddCcZCBJCeNN+Ymhohy4AG9lDgHB/XxertW+u2Qsd5XPXFmoxMn71UJ0yT8QdQSwcIu0AVyp4AAAAEAQAAUEsDBBQACAAIAMi8clkAAAAAAAAAACoAAAAcACAAdGVzdC1wYWNrYWdlLTEuMC4xL1JFQURNRS5tZFVUDQAHOBY8ZzkWPGcfFjxndXgLAAEEAAAAAAQAAAAAC3J1dPF1VUjLzElVSMsvUihJLS7RLUhMzk5MT1UoSy0qzszPUzDUM9AzBABQSwcIZ9DPRCwAAAAqAAAAUEsBAhQDFAAAAAAAubxyWQAAAAAAAAAAAAAAABMAIAAAAAAAAAAAAP9BAAAAAHRlc3QtcGFja2FnZS0xLjAuMS9VVA0ABx8WPGdlFjxnHxY8Z3V4CwABBAAAAAAEAAAAAFBLAQIUAxQACAAIAMa8clm7QBXKngAAAAQBAAAfACAAAAAAAAAAAAC2gVEAAAB0ZXN0LXBhY2thZ2UtMS4wLjEvcGFja2FnZS5qc29uVVQNAAc0FjxnNhY8Zx8WPGd1eAsAAQQAAAAABAAAAABQSwECFAMUAAgACADIvHJZZ9DPRCwAAAAqAAAAHAAgAAAAAAAAAAAAtoFcAQAAdGVzdC1wYWNrYWdlLTEuMC4xL1JFQURNRS5tZFVUDQAHOBY8ZzkWPGcfFjxndXgLAAEEAAAAAAQAAAAAUEsFBgAAAAADAAMAOAEAAPIBAAAAAA==",
                    debloat: false,
                    JSProgram: "console.log('Hello, World!');",
                },
            };
            const response = await axios.post(`${baseUrl}/package/${first_id}`, requestBody);
            ids.push(response.data.metadata.ID);
        }
    }, 240000);
    afterAll(async () => {
        // Reset the registry after running the tests
        await axios.delete(`${baseUrl}/reset`);
    }, timeout);
    
    it("should fetch all packages and return 200 status", async () => {
        const requestBody: PackageQuery[] = [{ Name: "*" }];
        const response = await axios.post(`${baseUrl}/packages`, requestBody);
        const offset: EnumerateOffset = response.headers.offset;
        const packages: PackageMetadata[] = response.data;
        expect(response.status).toBe(200);
        expect(packages).not.toBeNull();
        expect(packages.length).toBe(ids.length);
        expect(offset).toBe(String(packages.length));

    }, timeout);

    it("should fetch all packages in a given SemVer range and return 200 status", async () => {
        const requestBody: PackageQuery[] = [{ Name: "test-package", Version: ">=1.0.1 <1.2.0" }];
        const response = await axios.post(`${baseUrl}/packages`, requestBody);
        const offset: EnumerateOffset = response.headers.offset;
        const packages: PackageMetadata[] = response.data;

        expect(response.status).toBe(200);
        expect(packages).not.toBeNull();
        expect(packages.length).toBe(4);
        // convert ids.length to string to compare with the ID of the fetched packages
        expect(offset).toBe(String(packages.length));

    }, timeout);

    it("should return 400 status when an invalid SemVer range is provided", async () => {
        const requestBody: PackageQuery[] = [{ Name: "test-package", Version: ">=1.0.1 <1.2.0 <1.3.0" }];
        try {
            await axios.post(`${baseUrl}/packages`, requestBody);
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

});