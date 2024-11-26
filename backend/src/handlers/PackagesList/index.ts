import { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import { DynamoDBClient, QueryCommand, QueryCommandInput, ScanCommand } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";


const utilsPath = process.env.UTILS_PATH || 'common/utils';
const interfacesPath = process.env.INTERFACES_PATH || 'common/interfaces';
// eslint-disable-next-line @typescript-eslint/no-require-imports
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const { createErrorResponse } = require(utilsPath);
// eslint-disable-next-line @typescript-eslint/no-require-imports
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const interfaces = require(interfacesPath);
type PackageQuery = typeof interfaces.PackageQuery;
type PackageMetadata = typeof interfaces.PackageMetadata;
type PackageTableRow = typeof interfaces.PackageTableRow;

import semver from "semver";

const PAGE_SIZE = 50;


export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
    try {
        const dynamoDBClient = DynamoDBDocumentClient.from(new DynamoDBClient());

        // Parse request body
        if (!event.body) {
            return createErrorResponse(400, "Request body is required.");
        }

        let packageQueries: PackageQuery[];
        try {
            packageQueries = JSON.parse(event.body);
        } catch {
            return createErrorResponse(400, "Invalid JSON in request body.");
        }

        // check that each package query has a name. If there is a version, it must be a valid semver range
        for (const query of packageQueries) {
            if (!query.Name) {
                return createErrorResponse(400, "Package name is required.");
            }
            if (query.Version && !semver.validRange(query.Version)) {
                return createErrorResponse(400, `Invalid semver range: ${query.Version}`);
            }
        }

        // Parse offset from query parameters
        const offset = parseOffset(event.queryStringParameters?.offset);

        // Perform package search
        const { items, newOffset } = await searchPackages(dynamoDBClient, packageQueries, offset);

        // Prepare response with updated offset
        const responseHeaders = { offset: newOffset.toString() };
        return createSuccessResponse(200, items, responseHeaders);
    } catch (error) {
        console.error("Error processing request:", error);
        return createErrorResponse(500, "Internal server error occurred.");
    }
};

export function parseOffset(offset?: string): number {
    const parsed = parseInt(offset || "0", 10);
    if (isNaN(parsed) || parsed < 0) {
        throw new Error("Invalid offset provided.");
    }
    return parsed;
}


async function searchPackages(
    dynamoDBClient: DynamoDBClient,
    packageQueries: PackageQuery[],
    offset: number
): Promise<{ items: PackageMetadata[]; newOffset: number }> {
    let queryResults: PackageMetadata[] = [];  // List of 

    // Fetch all packages if a single query is "*"
    if (packageQueries.length === 1 && packageQueries[0].Name === "*") {
        queryResults = await fetchAllPackages(dynamoDBClient);
    }

    for (const query of packageQueries) {
        const packages: PackageMetadata[] = await fetchPackagesForQuery(dynamoDBClient, query);
        queryResults.push(...packages);
    }

    // remove duplicates
    queryResults = queryResults.filter((item, index) => queryResults.findIndex(i => i.ID === item.ID) === index);

    // Pagination: Return only the next PAGE_SIZE results
    if (offset >= queryResults.length) {
        return { items: [], newOffset: offset };
    }
    const items: PackageMetadata[] = queryResults.slice(offset, offset + PAGE_SIZE);
    const newOffset = offset + items.length;
    return { items, newOffset };
}

// Fetch packages for a single query
async function fetchPackagesForQuery(
    dynamoDBClient: DynamoDBClient,
    query: PackageQuery
): Promise<PackageMetadata[]> {
    const params: QueryCommandInput = {
        TableName: "PackageMetadata",
        IndexName: "PackageNameVersionIndex",
        KeyConditionExpression: "PackageName = :name",
        ExpressionAttributeValues: {
            ":name": { S: query.Name },
        },
    };

    const result = await dynamoDBClient.send(new QueryCommand(params));

    const mappedItems: PackageMetadata[] = (result.Items || []).map(item => ({
        Name: item.PackageName?.S || "",
        Version: item.Version?.S || "",
        ID: item.ID?.S || "",
    }));

    if (query.Version) {
        return filterVersions(mappedItems, query.Version);
    }
    return mappedItems;
}

// Filter results based on semVer range
function filterVersions(items: PackageMetadata[], versionRange: string): PackageMetadata[] {
    return items.filter((item) => {
        return semver.satisfies(item.Version, versionRange);
    });
}

async function fetchAllPackages(dynamoDBClient: DynamoDBClient): Promise<PackageMetadata[]> {
    const params = {
        TableName: "PackageMetadata",
    };

    let allPackages: PackageTableRow[] = [];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let lastEvaluatedKey: Record<string, any> | undefined = undefined;

    do {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const result: { Items?: any[]; LastEvaluatedKey?: Record<string, any> } = await dynamoDBClient.send(
            new ScanCommand({ ...params, ExclusiveStartKey: lastEvaluatedKey })
        );
        allPackages = [...allPackages, ...(result.Items || [])];
        lastEvaluatedKey = result.LastEvaluatedKey;
    } while (lastEvaluatedKey);

    const mappedItems: PackageMetadata[] = (allPackages).map(item => ({
        Name: item.PackageName || "",
        Version: item.Version || "",
        ID: item.ID || "",
    }));

    return mappedItems;
}

function createSuccessResponse(
    statusCode: number,
    data: PackageMetadata[],
    headers: Record<string, string>
): APIGatewayProxyResult {
    return {
        statusCode,
        headers: { "Access-Control-Allow-Origin": "*", "Content-Type": "application/json", ...headers },
        body: JSON.stringify(data),
    };
}
