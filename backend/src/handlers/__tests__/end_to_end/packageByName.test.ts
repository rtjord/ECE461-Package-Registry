import axios from "axios";
import { Package, PackageData } from "../../../common/interfaces";
import { baseUrl } from "./config";

const timeout = 60000;

describe("E2E Test for Package By Name Endpoint", () => {
    let id: string;
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
        id = response.data.metadata.ID;

        // Upload a package with a URL to the registry
        const requestBody2: Package = {
            metadata: {
                Name: "test-package",
                Version: "1.0.1",
                ID: id,
            },
            data: {
                Name: "test-package",
                Content: "UEsDBBQAAAAAANard1kAAAAAAAAAAAAAAAATACAAdGVzdC1wYWNrYWdlLTEuMC4xL1VUDQAH5Z1CZ4fjSGflnUJndXgLAAEEAAAAAAQAAAAAUEsDBBQACAAIANard1kAAAAAAAAAAAQBAAAfACAAdGVzdC1wYWNrYWdlLTEuMC4xL3BhY2thZ2UuanNvblVUDQAH5Z1CZyHjSGflnUJndXgLAAEEAAAAAAQAAAAAXc89D4IwEAbgnYT/cLmBSYmsbMY4OOPI0pRTTqUlvWpIDP/dlq/Bbten7+XtN00gHDSqIywBPYnf90o/1Z1wt+CHnLA10Yv8kBcbNCTace8XvIYw/Ic7xROyaWjIH7LBHJVgS4npNhaIz0m3Fmo8O2ddCcZCBJCeNN+Ymhohy4AG9lDgHB/XxertW+u2Qsd5XPXFmoxMn71UJ0yT8QdQSwcIu0AVyp4AAAAEAQAAUEsDBBQACAAIAAt9fFkAAAAAAAAAADYAAAAcACAAdGVzdC1wYWNrYWdlLTEuMC4xL1JFQURNRS5tZFVUDQAHRuNIZ0bjSGflnUJndXgLAAEEAAAAAAQAAAAAC8nILFYAokSFIFdHF19XhbTMnFSF8sySjPzSEoWSjFSFvMTcVIX8NDC7IDE5OzE9VQ8AUEsHCPg5dEszAAAANgAAAFBLAQIUAxQAAAAAANard1kAAAAAAAAAAAAAAAATACAAAAAAAAAAAAD/QQAAAAB0ZXN0LXBhY2thZ2UtMS4wLjEvVVQNAAflnUJnh+NIZ+WdQmd1eAsAAQQAAAAABAAAAABQSwECFAMUAAgACADWq3dZu0AVyp4AAAAEAQAAHwAgAAAAAAAAAAAAtoFRAAAAdGVzdC1wYWNrYWdlLTEuMC4xL3BhY2thZ2UuanNvblVUDQAH5Z1CZyHjSGflnUJndXgLAAEEAAAAAAQAAAAAUEsBAhQDFAAIAAgAC318Wfg5dEszAAAANgAAABwAIAAAAAAAAAAAALaBXAEAAHRlc3QtcGFja2FnZS0xLjAuMS9SRUFETUUubWRVVA0AB0bjSGdG40hn5Z1CZ3V4CwABBAAAAAAEAAAAAFBLBQYAAAAAAwADADgBAAD5AQAAAAA=",
                debloat: false,
                JSProgram: "console.log('Hello, World!');",
            },
        };

        await axios.post(`${baseUrl}/package/${id}`, requestBody2);

    }, 90000);
    afterAll(async () => {
        // Reset the registry after running the tests
        await axios.delete(`${baseUrl}/reset`);
    }, 90000);
    
    it("should return a 200 status for a package that exists", async () => {
        const response = await axios.get(`${baseUrl}/package/byName/test-package`);
        expect(response.status).toBe(200);
        expect(response.data.length).toBe(2);

    }, timeout);

    it("should return a 404 status for a package that does not exist", async () => {
        try {
            await axios.get(`${baseUrl}/package/byName/non-existent-package`);
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