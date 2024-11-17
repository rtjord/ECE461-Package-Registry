import { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import { DynamoDBClient, QueryCommand, QueryCommandInput } from "@aws-sdk/client-dynamodb";
import { createErrorResponse, createSuccessResponse } from "./utils";
import { PackageMetadata, PackageQuery } from "./interfaces";
import semver from "semver"; // Ensure semver is installed

const MAX_RESULTS = 50;
const PAGE_SIZE = 50;


export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
    try {
        const dynamoDBClient = new DynamoDBClient();

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

        // Parse offset from query parameters
        const offset = parseOffset(event.queryStringParameters?.offset);

        console.log("Searching for packages with queries:", packageQueries);
        // Perform package search
        const { items, newOffset } = await searchPackages(dynamoDBClient, packageQueries, offset);

        // Pagination: Ensure results do not exceed MAX_RESULTS
        if (items.length > MAX_RESULTS) {
            return createErrorResponse(413, "Too many packages returned.");
        }

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
    const allPackages: PackageMetadata[] = [];

    for (const query of packageQueries) {
        const queryResults: PackageMetadata[] = await fetchPackagesForQuery(dynamoDBClient, query);
        allPackages.push(...queryResults);
    }

    // Pagination: Return only the next PAGE_SIZE results
    if (offset >= allPackages.length) {
        return { items: [], newOffset: offset };
    }

    const items: PackageMetadata[] = allPackages.slice(offset, offset + PAGE_SIZE);
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
