import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import semver from "semver";

const commonPath = process.env.COMMON_PATH || '/opt/nodejs/common';
const { createErrorResponse, generatePackageID, getEnvVariable } = require(`${commonPath}/utils`);
const { getPackageByName } = require(`${commonPath}/dynamodb`);
const { getPackageById } = require(`${commonPath}/dynamodb`);
const { retrieveFromOpenSearch } = require(`${commonPath}/opensearch`);
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const interfaces = require(`${commonPath}/interfaces`);
type PackageCost = typeof interfaces.PackageCost;
type PackageTableRow = typeof interfaces.PackageTableRow;
type PackageMetadata = typeof interfaces.PackageMetadata;

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
        // Default to false if not provided
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
            console.log("Cost calculation will include dependencies.");
            const packageCostMap = {};
            await calculateCost(packageId, packageCostMap);
            response = packageCostMap;

        } else {  // Otherwise, only add the standalone cost
            response[packageId] = {
                totalCost: standaloneCost,
            };
        }

        console.log("Cost calculation complete.");
        console.log("Response:", response);
        return {
            statusCode: 200,
            body: JSON.stringify(response),
            headers: {
                'Content-Type': 'application/json',
            },
        };
    } catch (error) {
        console.error("Error:", error);
        return createErrorResponse(500, "Error while calculating the cost.");
    }
};

// Calculate the cost of a package and its dependencies
export async function calculateCost(packageId: string, costMap: PackageCost): Promise<number> {
    // Check if the package exists in our registry
    const packageRow: PackageTableRow | null = await getPackageById(dynamoDBClient, packageId);
    console.log('packageRow', packageRow);
    if (!packageRow) {
        console.log(`Package does not exist in our registry.`);
        return 0;
    }
    // Get the package.json content from OpenSearch
    console.log(`Retrieving package.json for ${packageRow.PackageName}@${packageRow.Version}...`);
    const { content: packageJsonContent } = await retrieveFromOpenSearch(getEnvVariable('DOMAIN_ENDPOINT'), 'packagejsons', packageId);
    console.log(`Retrieved package.json for ${packageRow.PackageName}@${packageRow.Version}.`);
    const packageJson = JSON.parse(packageJsonContent);

    // Add the package to the cost map
    if (!costMap[packageId]) {
        costMap[packageId] = {};
    }
    // Add the standalone cost to the cost map
    const standaloneCost = packageRow.standaloneCost;
    costMap[packageId]["standaloneCost"] = standaloneCost;

    // Get the dependencies from the package.json file
    const dependencies = packageJson["dependencies"] || {};
    console.log("dependencies", dependencies);
    const dependencyIds: string[] = [];

    // Get a list of all the dependency IDs that exist in our registry
    for (const [depName, versionRange] of Object.entries(dependencies)) {
        const version = await findMatchingVersion(depName, versionRange as string);
        if (!version) {
            console.log(`No matching version found for ${depName}@${versionRange}`);
            continue;
        }
        console.log(`Found matching version ${depName}@${version}`);
        const depId = generatePackageID(depName, version);
        dependencyIds.push(depId);
    }

    // start with the standalone cost
    let totalCost = standaloneCost;
    for (const depId of dependencyIds) {
        // if the cost of the dependency has already been calculated, use it
        if (costMap[depId] && costMap[depId].totalCost) {
            totalCost += costMap[depId].totalCost;
            continue;
        }
        // otherwise, calculate the cost of the dependency
        const depCost = await calculateCost(depId, costMap);
        // add the cost of the dependency to the total cost
        totalCost += depCost;
    }
    // add the total cost to the cost map
    costMap[packageId]["totalCost"] = totalCost;
    return totalCost;
}

export async function findMatchingVersion(name: string, versionRange: string): Promise<string | null> {
    const packages: PackageMetadata[] = await getPackageByName(dynamoDBClient, name);
    for (const p of packages) {
        if (semver.satisfies(p.Version, versionRange)) {
            return p.Version;
        }
    }
    return null;
}
