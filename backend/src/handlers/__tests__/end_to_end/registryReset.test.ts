import axios from "axios";

const baseUrl = "https://9ojr9pts13.execute-api.us-east-2.amazonaws.com/dev";

describe("E2E Test for Registry Reset Endpoint", () => {
    it("should return a 200 status", async () => {
        const response = await axios.delete(`${baseUrl}/reset`);
        expect(response.status).toBe(200);
    });
});