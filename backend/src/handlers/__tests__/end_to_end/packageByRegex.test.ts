import axios from "axios";
import { PackageData, PackageRegEx, PackageMetadata } from "../../../common/interfaces";
import { baseUrl } from "./config";


const timeout = 30000;

describe("E2E Test for Package By Regex Endpoint", () => {
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

    }, 90000);
    afterAll(async () => {
        // Reset the registry after running the tests
        await axios.delete(`${baseUrl}/reset`);
    }, timeout);
    
    it("should return a 200 status for a package that exists", async () => {
        const requestBody: PackageRegEx = {
            RegEx: "test-package|yazl"
        };

        const response = await axios.post(`${baseUrl}/package/byRegEx`, requestBody);
        expect(response.status).toBe(200);

        const expectedPackages: PackageMetadata[] = [{
            Name: "test-package",
            Version: "1.0.0",
            ID: content_id
        }, 
        {
            Name: "yazl",
            Version: "3.1.0",
            ID: url_id
        }];
        const packages: PackageMetadata[] = response.data;
        expect(packages).toEqual(expectedPackages);

    }, timeout);

    it("should return a 400 status for an invalid regex", async () => {
        const requestBody: PackageRegEx = {
            RegEx: "test-package|"
        };

        try {
            await axios.post(`${baseUrl}/package/byRegEx`, requestBody);
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

    it("should return a 404 status for a package that does not exist", async () => {
        const requestBody: PackageRegEx = {
            RegEx: "nonexistent-package"
        };

        try {
            await axios.post(`${baseUrl}/package/byRegEx`, requestBody);
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