import axios from "axios";
import { PackageData, RecommendationRequest, PackageMetadata } from "../../../common/interfaces";
import { baseUrl } from "./config";

const timeout = 60000;

async function upload(name: string, url: string) {
    const requestBody: PackageData = {
        Name: name,
        URL: url,
        debloat: false
    };

    await axios.post(`${baseUrl}/package`, requestBody);
}

describe("E2E Test for PackageRecommend Endpoint", () => {
    beforeAll(async () => {
        // Reset the registry before running the tests
        await axios.delete(`${baseUrl}/reset`);

        // Upload packages to the registry
        await upload("yazl", "https://www.npmjs.com/package/yazl");
        await upload("express", "https://www.npmjs.com/package/express");
        await upload("debug", "https://www.npmjs.com/package/debug");
        await upload("inversify", "https://www.npmjs.com/package/inversify");
        // await upload("axios", "https://www.npmjs.com/package/axios");
        await upload("tslib", "https://www.npmjs.com/package/tslib");
        await upload("lodash", "https://www.npmjs.com/package/lodash");


    }, 90000);
    afterAll(async () => {
        // Reset the registry after running the tests
        await axios.delete(`${baseUrl}/reset`);
    }, 90000);
    
    it("should return a list of 5 packages with express as the first", async () => {
        const requestBody: RecommendationRequest = {
            Description: "A library for zip file creation/extraction"
        };

        const response = await axios.post(`${baseUrl}/recommend`, requestBody);
        expect(response.status).toBe(200);

        const packages: PackageMetadata[] = response.data;
        expect(packages).toHaveLength(5);
        expect(packages[0]).toHaveProperty("Name", "yazl");

    }, timeout);

    it ("should return a 400 status if Description is empty", async () => {
        const requestBody: RecommendationRequest = {
            Description: ""
        };

        try {
            await axios.post(`${baseUrl}/recommend`, requestBody);
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