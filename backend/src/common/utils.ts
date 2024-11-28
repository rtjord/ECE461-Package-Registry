import { APIGatewayProxyResult } from "aws-lambda";

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