import { APIGatewayProxyResult } from "aws-lambda";

export function validatePackageQuery(query: any): void {
    if (!query.Name || typeof query.Name !== "string") {
        throw new Error("Invalid PackageQuery: Name is required and must be a string.");
    }
    if (query.Version && typeof query.Version !== "string") {
        throw new Error("Invalid PackageQuery: Version must be a string if provided.");
    }
}


export function parseOffset(offset?: string): number {
    const parsed = parseInt(offset || "0", 10);
    if (isNaN(parsed) || parsed < 0) {
        throw new Error("Invalid offset provided.");
    }
    return parsed;
}

export function createErrorResponse(statusCode: number, message: string): APIGatewayProxyResult {
    return {
        statusCode,
        headers: { "Access-Control-Allow-Origin": "*" },
        body: JSON.stringify({ error: message }),
    };
}


export function createSuccessResponse(
    statusCode: number,
    data: any,
    headers: Record<string, string>
): APIGatewayProxyResult {
    return {
        statusCode,
        headers: { "Access-Control-Allow-Origin": "*", "Content-Type": "application/json", ...headers },
        body: JSON.stringify(data),
    };
}
