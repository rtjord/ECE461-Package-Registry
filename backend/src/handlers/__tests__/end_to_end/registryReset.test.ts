import axios from "axios";
import { baseUrl } from "./config";

const timeout = 30000;
describe("E2E Test for Registry Reset Endpoint", () => {
    it("should return a 200 status", async () => {
        const response = await axios.delete(`${baseUrl}/reset`);
        expect(response.status).toBe(200);
    }, timeout);
});