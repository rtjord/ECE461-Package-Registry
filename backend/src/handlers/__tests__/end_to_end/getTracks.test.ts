import axios from "axios";
import { baseUrl } from "./config";


describe("E2E Test for GetTracks Endpoint", () => {
  const endpoint = "/tracks"; // Adjust if needed based on your routing

  it("should return planned tracks successfully", async () => {
    try {
      const response = await axios.get(`${baseUrl}${endpoint}`, {
        headers: { "Content-Type": "application/json" },
      });

      // Assertions
      expect(response.status).toBe(200);
      expect(response.headers["content-type"]).toContain("application/json");

      const responseBody = response.data;
      expect(responseBody).toHaveProperty("plannedTracks");
      expect(responseBody.plannedTracks).toEqual(["ML inside track"]);
    } catch (error) {
      console.error("Error in E2E test:", error);
      throw error; // Fail the test if there's an error
    }
  });
});
