import axios from "axios";
import { PackageData, PackageCost } from "../../../common/interfaces";
import { baseUrl } from "./config";


const timeout = 30000;

describe("E2E Test for Get Cost Endpoint", () => {
    let yazl_id: string;
    let buffer_crc32_id: string;
    let circular1_id: string;
    let circular2_id: string;
    beforeAll(async () => {
        // Reset the registry before running the tests
        await axios.delete(`${baseUrl}/reset`, { timeout: 60000 });

        // Upload yazl to the registry
        const requestBody: PackageData = {
            Name: "yazl",
            URL: "https://www.npmjs.com/package/yazl/v/3.1.0",
            debloat: false,
            JSProgram: "console.log('Hello, World!');",
        };

        const response = await axios.post(`${baseUrl}/package`, requestBody);

        // Get the ID of the uploaded package
        yazl_id = response.data.metadata.ID;

        // Upload a package with a URL to the registry
        const requestBody2: PackageData = {
            Name: "buffer-crc32",
            URL: "https://www.npmjs.com/package/buffer-crc32",
            debloat: false,
        };

        const response2 = await axios.post(`${baseUrl}/package`, requestBody2);
        // Get the ID of the uploaded package
        buffer_crc32_id = response2.data.metadata.ID;

        // Upload circular1 to the registry
        const requestBody3: PackageData = {
            Name: "circular1",
            Content: "UEsDBBQAAAAAAG9whVkAAAAAAAAAAAAAAAAQACAAY2lyY3VsYXIxLTEuMC4wL1VUDQAHAvlRZ875UWfi+FFndXgLAAEEAAAAAAQAAAAAUEsDBBQACAAIAJdwhVkAAAAAAAAAACQBAAAcACAAY2lyY3VsYXIxLTEuMC4wL3BhY2thZ2UuanNvblVUDQAHTvlRZ075UWcC+VFndXgLAAEEAAAAAAQAAAAATY8xD4IwEIV3Ev7DpQOTIeDIZoyDs44sTTnlFNqmLYbE8N9tS0XHe9+9u/feeQbAJB+RNcAEGTEN3NRsF/UXGktKBlSXVVkluUMrDGmX0BWtA83Fk98xbYycIiLZ4Vw+bJJXm/Uk/vWK896wiKJX0LKTMco0IBUEAFajoBth1zIoCsCZHNQsWJf1IJ9cr8wW4rCOKxtIoLSx1/ly3KJr9JmkIPyP8S2+/1WNX/JsybMPUEsHCAuoi1+xAAAAJAEAAFBLAwQUAAgACAB5cIVZAAAAAAAAAAAzAAAAGQAgAGNpcmN1bGFyMS0xLjAuMC9SRUFETUUubWRVVA0ABxb5UWcW+VFnAvlRZ3V4CwABBAAAAAAEAAAAAAtydXTxdVVIy8xJVUjLL1JIzixKLs1JLFJISS1IzUtJzUuuVDBSKEstKs7Mz1Mw1DPQMwAAUEsHCF/kfYg1AAAAMwAAAFBLAQIUAxQAAAAAAG9whVkAAAAAAAAAAAAAAAAQACAAAAAAAAAAAAD/QQAAAABjaXJjdWxhcjEtMS4wLjAvVVQNAAcC+VFnzvlRZ+L4UWd1eAsAAQQAAAAABAAAAABQSwECFAMUAAgACACXcIVZC6iLX7EAAAAkAQAAHAAgAAAAAAAAAAAAtoFOAAAAY2lyY3VsYXIxLTEuMC4wL3BhY2thZ2UuanNvblVUDQAHTvlRZ075UWcC+VFndXgLAAEEAAAAAAQAAAAAUEsBAhQDFAAIAAgAeXCFWV/kfYg1AAAAMwAAABkAIAAAAAAAAAAAALaBaQEAAGNpcmN1bGFyMS0xLjAuMC9SRUFETUUubWRVVA0ABxb5UWcW+VFnAvlRZ3V4CwABBAAAAAAEAAAAAFBLBQYAAAAAAwADAC8BAAAFAgAAAAA=",
            debloat: false,
        };
        const response3 = await axios.post(`${baseUrl}/package`, requestBody3);
        circular1_id = response3.data.metadata.ID;

        // Upload circular2 to the registry
        const requestBody4: PackageData = {
            Name: "circular2",
            Content: "UEsDBBQAAAAAAG5whVkAAAAAAAAAAAAAAAAQACAAY2lyY3VsYXIyLTEuMC4wL1VUDQAHAflRZ9j5UWf4+FFndXgLAAEEAAAAAAQAAAAAUEsDBBQACAAIAJtwhVkAAAAAAAAAACQBAAAcACAAY2lyY3VsYXIyLTEuMC4wL3BhY2thZ2UuanNvblVUDQAHVvlRZ1b5UWcB+VFndXgLAAEEAAAAAAQAAAAATY8xD4IwEIV3Ev7DpQOTIeDIZoyDs44sTTnlFNqmLYbE8N9tS0XHe9+9u/feeQbAJB+RNcAEGTEN3OzZLuovNJaUDKguq7JKcodWGNIuoStaB5qLJ79j2hg5RUSyw7l82CSvNutJ/OsV571hEUWvoGUnY5RpQCoIAKxGQTfCrmVQFIAzOahZsC7rQT65XpktxGEdVzaQQGljr/PluEXX6DNJQfgf41u8/lWNX/JsybMPUEsHCG+FnauxAAAAJAEAAFBLAwQUAAgACAB0cIVZAAAAAAAAAAAzAAAAGQAgAGNpcmN1bGFyMi0xLjAuMC9SRUFETUUubWRVVA0ABw35UWcO+VFnAflRZ3V4CwABBAAAAAAEAAAAAAtydXTxdVVIy8xJVUjLL1JIzixKLs1JLFJISS1IzUtJzUuuVDBUKEstKs7Mz1Mw1DPQMwAAUEsHCCaOAJk1AAAAMwAAAFBLAQIUAxQAAAAAAG5whVkAAAAAAAAAAAAAAAAQACAAAAAAAAAAAAD/QQAAAABjaXJjdWxhcjItMS4wLjAvVVQNAAcB+VFn2PlRZ/j4UWd1eAsAAQQAAAAABAAAAABQSwECFAMUAAgACACbcIVZb4Wdq7EAAAAkAQAAHAAgAAAAAAAAAAAAtoFOAAAAY2lyY3VsYXIyLTEuMC4wL3BhY2thZ2UuanNvblVUDQAHVvlRZ1b5UWcB+VFndXgLAAEEAAAAAAQAAAAAUEsBAhQDFAAIAAgAdHCFWSaOAJk1AAAAMwAAABkAIAAAAAAAAAAAALaBaQEAAGNpcmN1bGFyMi0xLjAuMC9SRUFETUUubWRVVA0ABw35UWcO+VFnAflRZ3V4CwABBAAAAAAEAAAAAFBLBQYAAAAAAwADAC8BAAAFAgAAAAA=",
            debloat: false,
        };
        const response4 = await axios.post(`${baseUrl}/package`, requestBody4);
        circular2_id = response4.data.metadata.ID;

    }, 90000);
    afterAll(async () => {
        // Reset the registry after running the tests
        await axios.delete(`${baseUrl}/reset`, { timeout: 60000 });
    }, timeout);

    it("should only return total cost if dependency is false", async () => {
        const response = await axios.get(`${baseUrl}/package/${yazl_id}/cost?dependency=false`);
        expect(response.status).toBe(200);

        const cost: PackageCost = response.data;
        expect(cost).not.toBeNull();
        expect(cost[yazl_id].totalCost).toBeGreaterThan(0);
        expect(cost[yazl_id].standaloneCost).toBeUndefined();

    }, timeout);

    it("should return standalone cost and total cost if dependency is true", async () => {
        const response = await axios.get(`${baseUrl}/package/${yazl_id}/cost?dependency=true`);
        expect(response.status).toBe(200);

        const cost: PackageCost = response.data;
        expect(cost).not.toBeNull();
        expect(cost[yazl_id].standaloneCost).toBeGreaterThan(0);
        expect(cost[yazl_id].totalCost).toBeGreaterThan(0);
        expect(cost[buffer_crc32_id].standaloneCost).toBeGreaterThan(0);
        expect(cost[buffer_crc32_id].totalCost).toBeGreaterThan(0);

    }, timeout);

    it("should handle circular dependencies", async () => {
        const response = await axios.get(`${baseUrl}/package/${circular1_id}/cost?dependency=true`);
        expect(response.status).toBe(200);

        const cost: PackageCost = response.data;
        expect(cost).not.toBeNull();
        expect(cost[circular1_id].standaloneCost).toBeGreaterThan(0);
        expect(cost[circular1_id].totalCost).toBeGreaterThan(0);
        expect(cost[circular2_id].standaloneCost).toBeGreaterThan(0);
        expect(cost[circular2_id].totalCost).toBeGreaterThan(0);

    }, timeout);
    
    it("should return a 404 status if the package does not exist", async () => {
        try {
            await axios.get(`${baseUrl}/package/non-existant-id/cost`);
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

    it("should return a lower cost if debloat is true", async () => {
        const response = await axios.get(`${baseUrl}/package/${yazl_id}/cost`);
        expect(response.status).toBe(200);
        const originalCost = response.data[yazl_id].totalCost;

        // delete the package
        await axios.delete(`${baseUrl}/package/${yazl_id}`);
        // reupload the package with debloat set to true
        const requestBody: PackageData = {
            Name: "yazl",
            URL: "https://www.npmjs.com/package/yazl/v/3.1.0",
            debloat: true,
        };
        await axios.post(`${baseUrl}/package`, requestBody);
        const response2 = await axios.get(`${baseUrl}/package/${yazl_id}/cost`);
        expect(response2.status).toBe(200);
        const debloatedCost = response2.data[yazl_id].totalCost;

        // expect the debloated cost to be less than the original cost
        expect(debloatedCost).toBeLessThan(originalCost);

    }, timeout);

    // It should also return a 400 status if the package ID is missing
    // It does this when using sam local invoke, but I'm not sure how to test it here
});