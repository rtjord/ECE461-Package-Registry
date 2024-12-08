import { SecretsManagerClient } from "@aws-sdk/client-secrets-manager";
import {
  createErrorResponse,
  getEnvVariable,
  generatePackageID,
  getSecret,
  getScores,
  getRepoUrl,
  extractFieldFromPackageJson,
} from "../utils"; // Adjust path if needed
import { fromIni, fromNodeProviderChain } from "@aws-sdk/credential-providers";

const isGitHub = process.env.GITHUB_ACTIONS === "true";

describe("Function Tests", () => {
  let secretsClient: SecretsManagerClient;
  beforeAll(() => {
    secretsClient = new SecretsManagerClient({
      region: "us-east-2", credentials: isGitHub
        ? fromNodeProviderChain() // Use default credentials in GitHub Actions
        : fromIni({ profile: "dev" })
    });
  });

  describe("createErrorResponse", () => {
    it("should return a valid error response", () => {
      const statusCode = 400;
      const message = "Test error message";
      const response = createErrorResponse(statusCode, message);

      expect(response).toEqual({
        statusCode: 400,
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ message }),
      });
    });
  });

  describe("getEnvVariable", () => {
    it("should retrieve an environment variable", () => {
      process.env.TEST_VAR = "test_value";
      expect(getEnvVariable("TEST_VAR")).toBe("test_value");
    });

    it("should throw an error for undefined environment variable", () => {
      expect(() => getEnvVariable("UNDEFINED_VAR")).toThrow(
        "Environment variable UNDEFINED_VAR is not defined"
      );
    });
  });

  describe("generatePackageID", () => {
    it("should generate a unique package ID", () => {
      const name = "test-package";
      const version = "1.0.0";
      const id = generatePackageID(name, version);

      expect(id).toHaveLength(20); // Length of the base64url hash slice
      expect(typeof id).toBe("string");
    });
  });

  describe("getSecret", () => {
    it("should retrieve a secret from Secrets Manager", async () => {
      const secretName = "GitHubToken"; // Replace with an actual secret name
      const secret = await getSecret(secretsClient, secretName);
      const token = JSON.parse(secret) as { GitHubToken: string };
      const tokenValue = token.GitHubToken;

      expect(typeof tokenValue).toBe("string");
      expect(tokenValue).not.toBe(""); // Ensure the secret is not empty
    });
  });

  describe("getScores", () => {
    it("should calculate and return scores for a valid URL", async () => {
      const token = process.env.GITHUB_TOKEN || ""; // Replace with a valid token
      const url = "https://github.com/thejoshwolfe/yazl"; // Replace with a valid GitHub repo URL
      const scores = await getScores(token, url);

      expect(scores).toHaveProperty("NetScore");
      expect(scores.NetScore).not.toBe(-1); // Ensure scores were calculated
    }, 20000);

    it("should return empty scores for an invalid URL", async () => {
      const token = process.env.GITHUB_TOKEN || ""; // Replace with a valid token
      const url = "invalid-url"; // Replace with an invalid URL
      const scores = await getScores(token, url);

      expect(scores.NetScore).toBe(-1); // Ensure empty scores are returned
    });
  });

  describe("getRepoUrl", () => {
    it("should fetch the GitHub repo URL from an NPM package URL", async () => {
      const npmUrl = "https://www.npmjs.com/package/yazl"; // Replace with a valid NPM package URL
      const repoUrl = await getRepoUrl(npmUrl);

      expect(repoUrl).toContain("https://github.com/thejoshwolfe/yazl");
    });

    it("should handle invalid NPM package URLs gracefully", async () => {
      const npmUrl = "https://invalid-npm-url.com";
      const repoUrl = await getRepoUrl(npmUrl);

      expect(repoUrl).toEqual(""); // Check for failure
    });
  });

  describe("extractFieldFromPackageJson", () => {
    it("should extract a field from package.json content", () => {
      const packageJson = JSON.stringify({
        name: "test-package",
        version: "1.0.0",
      });
      const field = "name";
      const value = extractFieldFromPackageJson(packageJson, field);

      expect(value).toBe("test-package");
    });

    it("should return undefined for a missing field", () => {
      const packageJson = JSON.stringify({
        name: "test-package",
        version: "1.0.0",
      });
      const field = "description";
      const value = extractFieldFromPackageJson(packageJson, field);

      expect(value).toBeUndefined();
    });
  });
});
