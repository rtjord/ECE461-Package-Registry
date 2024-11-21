import axios from "axios";


const baseUrl = "http://127.0.0.1:3000";

describe("E2E Test for Authentication Endpoint", () => {
    // Replace with the actual API Gateway URL where the Lambda function is deployed

    it("should return a 501 status with the expected message", async () => {
        const endpoint = "/authenticate"; // Adjust if needed based on your routing
        try {
            // Make a GET request to the API
            await axios.put(`${baseUrl}${endpoint}`, null, {
                headers: { "Content-Type": "application/json" },
            });

        } catch (error) {  // There should be an AxiosError because the status code is 501
            if (!axios.isAxiosError(error)) {
                throw error;
            }
            
            const response = error.response;
            if (!response) {
                throw error; // Fail the test if there's no response
            }
            // Assertions for the response
            expect(response.status).toBe(501); // Check HTTP status code
        }
    });
});
