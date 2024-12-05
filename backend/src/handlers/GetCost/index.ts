import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import { spawnSync } from "child_process";
import * as fs from 'fs-extra';
import * as path from 'path';

const commonPath = process.env.COMMON_PATH || '/opt/nodejs/common';
const { createErrorResponse, generatePackageID, getEnvVariable } = require(`${commonPath}/utils`);
const { getPackageById } = require(`${commonPath}/dynamodb`);
const { zipDirectory } = require(`${commonPath}/zip`);
const { retrieveFromOpenSearch } = require(`${commonPath}/opensearch`);
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const interfaces = require(`${commonPath}/interfaces`);
type PackageCost = typeof interfaces.PackageCost;
type PackageTableRow = typeof interfaces.PackageTableRow;

const dynamoDBClient = DynamoDBDocumentClient.from(new DynamoDBClient({
    region: 'us-east-2',
}));

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
    try {

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

        let response: PackageCost = {};

        const standaloneCost = packageRow.standaloneCost;
        console.log(`Calculating costs for ${packageRow.PackageName}@${packageRow.Version}...`);
        // If we need to include dependencies, recursively calculate the costs
        if (includeDependencies) {
            // Switch to fetching package.json from opensearch
            // Need to save package.json to opensearch
            let { content: packageJson } = await retrieveFromOpenSearch(getEnvVariable('DOMAIN_ENDPOINT'), 'packagejsons', packageId)
            packageJson = JSON.parse(packageJson);
            const packageCostMap: PackageCost = await calculatePackageCosts(packageId, standaloneCost, packageJson, {});
            response = packageCostMap;

        } else {  // Otherwise, only add the standalone cost
            response[packageId] = {
                totalCost: standaloneCost,
            };
        }

        console.log("Cost calculation complete.");
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


// We measure the total cost of a package by putting it's name and version in its own package.json file, 
// and then running npm install --omit=dev in a temporary directory. 
// We then zip the node_modules directory and calculate the size of the zipped node_modules. 
// This size is the total cost of the package.

// We measure the dependency cost of a package by getting the package.json file of the package,
// and then running npm install --omit=dev in a temporary directory.
// We then zip the node_modules directory and calculate the size of the zipped node_modules.
// This size is the dependency cost of the package.



// Measure the cost of installing every dependency in the package.json file
export async function calculateCost(packageJsonContent: string): Promise<number> {
    const tempDir = path.join("/tmp", `npm_temp_${Date.now()}`);
    const packageJsonPath = path.join(tempDir, "package.json");

    // Check if the package.json file has dependencies
    const packageJson = JSON.parse(packageJsonContent);
    if (!packageJson.dependencies) {
        return 0;
    }
    
    try {
        // Step 1: Create a temporary directory
        await fs.ensureDir(tempDir);

        // Step 2: Write the provided package.json content to a file
        await fs.writeFile(packageJsonPath, packageJsonContent);

        // Step 3: Run npm install in the temporary directory
        console.log("Installing dependencies...");
        // execSync("npm install --omit=dev", { cwd: tempDir, stdio: "inherit" });
        spawnSync('npm', ['install', '--omit=dev'], {
            cwd: tempDir,
            stdio: 'inherit',
        });

        // Step 4: Zip the node_modules directory
        console.log("Zipping node_modules...");
        const nodeModulesPath = path.join(tempDir, "node_modules");
        if (!(await fs.pathExists(nodeModulesPath))) {
            return 0;
        }
        const zipBuffer: Buffer = await zipDirectory(nodeModulesPath);

        // Step 5: Calculate the size of the zipped node_modules
        const zippedSize = zipBuffer.length / (1024 * 1024); // Convert to MB

        console.log(`Size of zipped node_modules: ${zippedSize.toFixed(5)} MB`);
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

// Main function to calculate costs for a package
export async function calculatePackageCosts(
    packageId: string,
    standaloneCost: number,
    packageJsonContent: string,
    packageCostMap: PackageCost = {}
): Promise<PackageCost> {
    
    // Create a temporary directory to install dependencies later
    const tempDir = path.join("/tmp", `npm_temp_${Date.now()}`);
    await fs.ensureDir(tempDir);
    const packageJsonPath = path.join(tempDir, "package.json");
    await fs.writeFile(packageJsonPath, packageJsonContent);

    try {
        // Calculate total cost of the top-level package (may not be npm package)
        const packageJson = JSON.parse(packageJsonContent);  // Parse the package.json content
        const { name, version } = packageJson;  // Extract the name and version of the package 
        const dependenciesCost =  await calculateCost(packageJsonContent); // Calculate the const of dependencies
        const totalCost = standaloneCost + dependenciesCost;  // add the standalone cost to the dependencies cost

        console.log(`Standalone cost for ${name}@${version}: ${standaloneCost} MB`);
        console.log(`Total cost for ${name}@${version}: ${totalCost} MB`);

        // Update the cost map
        packageCostMap[packageId] = {
            standaloneCost,
            totalCost,
        };

        // If there are no dependencies, return the package cost map
        if (!packageJson.dependencies) {
            return packageCostMap;
        }
        // Recursively calculate costs for dependencies
        // execSync("npm install --omit=dev", { cwd: tempDir, stdio: "inherit" });  // install the dependencies
        spawnSync('npm', ['install', '--omit=dev'], {
            cwd: tempDir,
            stdio: 'inherit',
        });
        const nodeModulesPath = path.join(tempDir, "node_modules");  // get the node_modules path
        // Get the package.json files for the dependencies
        const packageJsonList = await getPackageJsonFilesFromNodeModules(nodeModulesPath);
        if (packageJsonList.length === 0) {
            return packageCostMap;
        }
        // Assume each dependency is an npm package and calculate the cost
        let i = 0;
        for (const file of packageJsonList) {
            i += 1;
            console.log(`Processing dependency ${i} of ${packageJsonList.length}`);
            await calculateNpmPackageCosts(file, packageCostMap, 1);
        }
        // console.log(packageJsonList);
        // await Promise.all(
        //     packageJsonList.map(file => 
        //         calculateNpmPackageCosts(file, packageCostMap, 1)
        //     )
        // );

        return packageCostMap;
    } catch (error) {
        console.error(`Failed to process package:`, error);
        throw error;
    } finally {
        // Cleanup
        await fs.remove(tempDir);
    }
}

export async function calculateNpmPackageCosts(
    packageJsonContent: string,
    packageCostMap: PackageCost = {},
    depth: number = 1
): Promise<PackageCost> {
    if (depth > 1) {
        console.error("Exceeded maximum depth of 1");
        return packageCostMap;
    }
    console.log("depth", depth);
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
        const standaloneCost = Math.max(0, totalCost - dependenciesCost);

        console.log(`Standalone cost for ${name}@${version}: ${standaloneCost.toFixed(5)} MB`);
        console.log(`Total cost for ${name}@${version}: ${totalCost.toFixed(5)} MB`);

        // Step 4: Update the cost map
        packageCostMap[packageId] = {
            standaloneCost,
            totalCost,
        };

        // Step 5: Recursively calculate costs for dependencies
        if (!packageJson.dependencies) {
            return packageCostMap;
        }
        
        console.log('executing npm install --omit=dev');
        // execSync("npm install --omit=dev", { cwd: tempDir, stdio: "inherit" });
        spawnSync('npm', ['install', '--omit=dev'], {
            cwd: tempDir,
            stdio: 'inherit',
        });
        console.log('npm install --omit=dev executed');
        // const nodeModulesPath = path.join(tempDir, "node_modules");
        // const packageJsonList = await getPackageJsonFilesFromNodeModules(nodeModulesPath);

        // for (const file of packageJsonList) {
        //     await calculateNpmPackageCosts(file, packageCostMap, depth + 1);
        // }
        // await Promise.all(
        //     packageJsonList.map(file => 
        //         calculateNpmPackageCosts(file, packageCostMap, depth + 1)
        //     )
        // );

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