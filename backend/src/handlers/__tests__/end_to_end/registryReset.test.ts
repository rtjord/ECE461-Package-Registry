import axios from "axios";

const url = "http://127.0.0.1:3000/reset";

describe("E2E Test for Registry Reset Endpoint", () => {
    it("should return a 200 status", async () => {
        const response = await axios.delete(url);
        expect(response.status).toBe(200);
    });
});