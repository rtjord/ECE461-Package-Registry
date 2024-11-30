import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";

const commonPath = process.env.COMMON_PATH || '/opt/nodejs/common';
const { createErrorResponse, generatePackageID } = require(`${commonPath}/utils`);
const { getPackageById } = require(`${commonPath}/dynamodb`);
const { zipDirectory } = require(`${commonPath}/zip`);
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const interfaces = require(`${commonPath}/interfaces`);
type PackageCost = typeof interfaces.PackageCost;
type PackageTableRow = typeof interfaces.PackageTableRow;

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
    try {
        const dynamoDBClient = DynamoDBDocumentClient.from(new DynamoDBClient());

        // Validate package ID from path parameters
        const packageId = event.pathParameters?.id;
        if (!packageId) {
            return createErrorResponse(400, "There is missing field(s) in the PackageID");
        }

        // Retrieve the dependency query parameter
        const includeDependencies = event.queryStringParameters?.dependency === 'true';

        // Fetch the package data from DynamoDB
        const packageRow: PackageTableRow | null = await getPackageById(dynamoDBClient, packageId);
        if (!packageRow) {
            return createErrorResponse(404, "Package does not exist.");
        }

        let packageJson: string = "";
        let response: PackageCost = {};

        console.log(`Calculating costs for ${packageRow.PackageName}@${packageRow.Version}...`);
        // If we need to include dependencies, recursively calculate the costs
        if (includeDependencies) {
            // Switch to fetching package.json from opensearch
            // Need to save package.json to opensearch
            packageJson = await fetchPackageJson(packageRow.PackageName, packageRow.Version);
            const packageCostMap: PackageCost = await calculatePackageCosts(packageJson, {});
            response = packageCostMap;
        
        } else {  // Otherwise, only add the standalone cost
            response[packageId] = {
                totalCost: packageRow.standaloneCost,
            };
        }

        // TODO: Return a list containing the standalone cost and total cost of the package and its dependencies
        // The list should have one entry per dependency, with the standalone cost and total cost of each dependency
        // Success response
        return {
            statusCode: 200,
            body: JSON.stringify(response),
            headers: {
                'Content-Type': 'application/json',
            },
        };
    } catch (error) {
        console.error("Error:", error);
        return createErrorResponse(500, "The package rating system choked on at least one of the metrics.");
    }
};


import pacote from "pacote";

/**
 * Fetches the package.json file for a specific npm package using its name and version.
 *
 * @param name - The name of the npm package
 * @param version - The specific version or version range (e.g., "latest", "^1.0.0")
 * @returns A promise that resolves to the content of the package.json file as a string
 */
export async function fetchPackageJson(name: string, version: string): Promise<string> {
    try {
        // Fetch the package manifest using pacote
        const manifest = await pacote.manifest(`${name}@${version}`);

        // Return the package.json content as a JSON string
        return JSON.stringify(manifest, null, 2);
    } catch (error) {
        console.error(`Failed to fetch package.json for ${name}@${version}:`, error);
        throw error;
    }
}

import * as fs from 'fs-extra';
import * as path from 'path';


// We measure the total cost of a package by putting that in its own package.json file, 
// and then running npm install --omit=dev in a temporary directory. 
// We then zip the node_modules directory and calculate the size of the zipped node_modules. 
// This size is the total cost of the package.

// We measure the dependency cost of a package by getting the package.json file of the package,
// and then running npm install --omit=dev in a temporary directory.
// We then zip the node_modules directory and calculate the size of the zipped node_modules.
// This size is the dependency cost of the package.


import { execSync } from "child_process";


// Measure the cost of installing every dependency in the package.json file
export async function calculateCost(packageJsonContent: string): Promise<number> {
    const tempDir = path.join("/tmp", `npm_temp_${Date.now()}`);
    const packageJsonPath = path.join(tempDir, "package.json");

    try {
        // Step 1: Create a temporary directory
        await fs.ensureDir(tempDir);

        // Step 2: Write the provided package.json content to a file
        await fs.writeFile(packageJsonPath, packageJsonContent);

        // Step 3: Run npm install in the temporary directory
        console.log("Installing dependencies...");
        execSync("npm install --omit=dev", { cwd: tempDir, stdio: "inherit" });

        // Step 4: Zip the node_modules directory
        console.log("Zipping node_modules...");
        const nodeModulesPath = path.join(tempDir, "node_modules");
        const zipBuffer: Buffer = await zipDirectory(nodeModulesPath);

        // Step 5: Calculate the size of the zipped node_modules
        const zippedSize = zipBuffer.length / (1024 * 1024); // Convert to MB

        console.log(`Size of zipped node_modules: ${zippedSize.toFixed(2)} MB`);
        return zippedSize;
    } catch (error) {
        console.error("Error while calculating size:", error);
        throw new Error("Failed to calculate size of zipped node_modules");
    } finally {
        // Step 6: Cleanup
        console.log("Cleaning up temporary files...");
        await fs.remove(tempDir);
    }
}

// Main function to calculate costs for a package and update the cost map
export async function calculatePackageCosts(
    packageJsonContent: string,
    packageCostMap: PackageCost = {}
): Promise<PackageCost> {
    const packageJson = JSON.parse(packageJsonContent);
    const { name, version } = packageJson;
    const packageId = generatePackageID(name, version);

    // Avoid reprocessing packages
    if (packageCostMap[packageId]) {
        return packageCostMap;
    }

    const tempDir = path.join("/tmp", `npm_temp_${Date.now()}`);
    await fs.ensureDir(tempDir);
    const packageJsonPath = path.join(tempDir, "package.json");
    await fs.writeFile(packageJsonPath, packageJsonContent);
    try {
        // Step 1: Calculate total cost
        const topPackageJson = JSON.stringify({
            name: "temp-package",
            version: "1.0.0",
            dependencies: { [name]: version },
        });
        const totalCost = await calculateCost(topPackageJson);

        // Step 2: Calculate dependency cost
        const dependenciesCost = await calculateCost(packageJsonContent);

        // Step 3: Calculate standalone cost
        const standaloneCost = totalCost - dependenciesCost;

        console.log(`Standalone cost for ${packageId}: ${standaloneCost.toFixed(2)} MB`);
        console.log(`Total cost for ${packageId}: ${totalCost.toFixed(2)} MB`);

        // Step 4: Update the cost map
        packageCostMap[packageId] = {
            standaloneCost,
            totalCost,
        };

        // Step 5: Recursively calculate costs for dependencies
        execSync("npm install --omit=dev", { cwd: tempDir, stdio: "inherit" });
        const nodeModulesPath = path.join(tempDir, "node_modules");
        const packageJsonList = await getPackageJsonFilesFromNodeModules(nodeModulesPath);

        for (const file of packageJsonList) {
            await calculatePackageCosts(file, packageCostMap);
        }

        return packageCostMap;
    } catch (error) {
        console.error(`Failed to process ${packageId}:`, error);
        throw error;
    } finally {
        // Cleanup
        await fs.remove(tempDir);
    }
}

/**
 * Retrieves package.json files that are exactly two levels deep in the node_modules directory.
 *
 * @param nodeModulesPath - Path to the node_modules directory
 * @returns An array of strings, each representing the content of a package.json file
 */
export async function getPackageJsonFilesFromNodeModules(nodeModulesPath: string): Promise<string[]> {
    const packageJsonFiles: string[] = [];

    if (!(await fs.pathExists(nodeModulesPath))) {
        return packageJsonFiles;
    }

    const levelOneDirs = await fs.readdir(nodeModulesPath, { withFileTypes: true });

    for (const levelOneDir of levelOneDirs) {
        if (levelOneDir.isDirectory()) {
            const levelOnePath = path.join(nodeModulesPath, levelOneDir.name);
            const packageJsonPath = path.join(levelOnePath, "package.json");

            if (await fs.pathExists(packageJsonPath)) {
                const packageJsonContent = await fs.readFile(packageJsonPath, "utf-8");
                packageJsonFiles.push(packageJsonContent);
            }
        }
    }

    return packageJsonFiles;
}