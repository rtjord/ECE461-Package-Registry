import { handler } from '../../PackageByNameGet'; // Replace with the correct path to your handler file
import { getPackageHistory } from '../../../common/dynamodb';
import { User, PackageMetadata } from '../../../common/interfaces';
import { APIGatewayProxyEvent } from 'aws-lambda';

jest.mock('@aws-sdk/lib-dynamodb', () => ({
    DynamoDBDocumentClient: {
        from: jest.fn(),
    },
}));

jest.mock('../../../common/dynamodb', () => ({
    getPackageHistory: jest.fn(),
}));

describe('Lambda Function - Handler', () => {
    const mockEvent: APIGatewayProxyEvent = {
        body: null,
        headers: {},
        multiValueHeaders: {},
        httpMethod: 'PUT',
        isBase64Encoded: false,
        path: '/package/byName/{name}',
        pathParameters: { name: 'example-package' },
        queryStringParameters: null,
        multiValueQueryStringParameters: null,
        stageVariables: null,
        requestContext: {} as APIGatewayProxyEvent['requestContext'],
        resource: ''
    };

    beforeEach(() => {
        jest.clearAllMocks();
    });

    test('should return 400 if package name is missing', async () => {
        const eventWithoutName = { ...mockEvent, pathParameters: null };
        const result = await handler(eventWithoutName);

        expect(result.statusCode).toBe(400);
    });

    test('should return 404 if no history is found', async () => {
        (getPackageHistory as jest.Mock).mockResolvedValue([]);
        const result = await handler(mockEvent);
        expect(result.statusCode).toBe(404);
    });

    test('should return 200 with package history', async () => {
        const mockUser: User = { name: 'ece30861defaultadminuser', isAdmin: true };
        const mockMetadata: PackageMetadata = {
            Name: 'example-package',
            Version: '1.0.0',
            ID: '01AFeio908233537g3dL',
        };
        const mockHistory = [{
            User: mockUser,
            Date: '2023-01-01T00:00:00Z',
            PackageMetadata: mockMetadata,
            Action: "CREATE",
        }];
        (getPackageHistory as jest.Mock).mockResolvedValue(mockHistory);

        const result = await handler(mockEvent);

        expect(result.statusCode).toBe(200);
        expect(result.headers?.['Access-Control-Allow-Origin']).toBe('*');
        expect(result.headers?.['Content-Type']).toBe('application/json');
        expect(JSON.parse(result.body)).toEqual(mockHistory);
    });

    test('should return 500 if an error occurs', async () => {
        (getPackageHistory as jest.Mock).mockRejectedValue(new Error('DynamoDB error'));

        const result = await handler(mockEvent);

        expect(result.statusCode).toBe(500);
    });
});
