import { APIGatewayProxyResult } from "aws-lambda";
import { createHash } from 'crypto';
import {
  SecretsManagerClient,
  GetSecretValueCommand
} from "@aws-sdk/client-secrets-manager";
import { repoData, envVars } from "../services/rate/utils/interfaces";
import { runAnalysis } from "../services/rate/tools/scripts";
import { metricCalc } from "../services/rate/tools/metricCalc";
import { urlAnalysis } from "../services/rate/tools/urlOps";
import { PackageRating } from "../common/interfaces";

// Function to create a consistent error response
export const createErrorResponse = (statusCode: number, message: string): APIGatewayProxyResult => {
  return {
    statusCode,
    headers: { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json' },
    body: JSON.stringify({ message }),
  };
};

// Validate environment variables
export function getEnvVariable(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Environment variable ${name} is not defined`);
  }
  return value;
}

// Generate a unique package ID based on the package name and version
export function generatePackageID(name: string, version: string): string {
  return createHash('sha256').update(name + version).digest('base64url').slice(0, 20);
}

export async function getSecret(client: SecretsManagerClient, secret_name: string): Promise<string> {
  const response = await client.send(
    new GetSecretValueCommand({
      SecretId: secret_name,
      VersionStage: "AWSCURRENT", // VersionStage defaults to AWSCURRENT if unspecified
    })
  );
  const secret = response.SecretString || "";
  return secret;
}

export async function getScores(token: string, url: string): Promise<PackageRating> {
  const envVars: envVars = {
    token: token,
    logLevel: 1,
    logFilePath: '/tmp/log.txt',
  }
  const runAnalysisClass = new runAnalysis(envVars);

  try {
    const repoData: repoData[] = await runAnalysisClass.runAnalysis([url]);
    const repo = repoData[0];
    const metricCalcClass = new metricCalc();
    const result: PackageRating = await metricCalcClass.getValue(repo);

    return result;
  } catch (error) {
    const emptyResult: PackageRating = {
      NetScore: -1,
      NetScoreLatency: -1,
      RampUp: -1,
      RampUpLatency: -1,
      Correctness: -1,
      CorrectnessLatency: -1,
      BusFactor: -1,
      BusFactorLatency: -1,
      ResponsiveMaintainer: -1,
      ResponsiveMaintainerLatency: -1,
      LicenseScore: -1,
      LicenseScoreLatency: -1,
      GoodPinningPractice: -1,
      GoodPinningPracticeLatency: -1,
      PullRequest: -1,
      PullRequestLatency: -1,
  };
    console.log('Error calculating score:', error);
    return emptyResult;
  }
}


// Function to get the GitHub repository URL from an NPM package URL
export async function getRepoUrl(url: string): Promise<string> {
  const envVars: envVars = {
    token: '',
    logLevel: 1,
    logFilePath: '/tmp/log.txt',
  }
  const urlOps = new urlAnalysis(envVars);
  const [status, repoUrl] = await urlOps.evalUrl(url);
  if (status === -1) {
    console.error('Failed to fetch GitHub repository URL from npm package.');
  }
  return repoUrl;
}

// Extract an arbitrary field from package.json content
export function extractFieldFromPackageJson(packageJson: string, field: string) {
  const metadata = JSON.parse(packageJson);
  return metadata[field];
}
