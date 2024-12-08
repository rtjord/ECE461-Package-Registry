import { APIGatewayProxyEvent } from 'aws-lambda';
import { handler } from '../../PackageRate';
import { getPackageById } from '../../../common/dynamodb';
import { PackageRating, PackageTableRow } from '../../../common/interfaces';


jest.mock('../../../common/dynamodb', () => ({
    getPackageById: jest.fn(),
}));

describe('Lambda Function - Handler', () => {
    const mockEvent: APIGatewayProxyEvent = {
        body: null,
        headers: {},
        multiValueHeaders: {},
        httpMethod: 'PUT',
        isBase64Encoded: false,
        path: '/authenticate',
        pathParameters: { id: '123' },
        queryStringParameters: null,
        multiValueQueryStringParameters: null,
        stageVariables: null,
        requestContext: {} as APIGatewayProxyEvent['requestContext'],
        resource: ''
    };

    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('should return 400 if package ID is missing', async () => {
        const eventWithoutId = { ...mockEvent, pathParameters: null };
        const result = await handler(eventWithoutId);

        expect(result.statusCode).toBe(400);
    });

    it('should return 404 if package does not exist', async () => {
        (getPackageById as jest.Mock).mockResolvedValue(null);

        const result = await handler(mockEvent);

        expect(result.statusCode).toBe(404);
        expect(getPackageById).toHaveBeenCalledWith(expect.anything(), '123');
    });

    it('should return 404 if package rating does not exist', async () => {
        (getPackageById as jest.Mock).mockResolvedValue(null);
        const result = await handler(mockEvent);

        expect(result.statusCode).toBe(404);
        expect(getPackageById).toHaveBeenCalledWith(expect.anything(), '123');
    });

    it('should return 200 with package rating', async () => {
        const mockRating: PackageRating = {
            NetScore: 0.834,
            NetScoreLatency: 0.186,
            RampUp: 0.500,
            RampUpLatency: 0.145,
            Correctness: 0.754,
            CorrectnessLatency: 0.1,
            BusFactor: 1,
            BusFactorLatency: 0.1,
            ResponsiveMaintainer: 0.259,
            ResponsiveMaintainerLatency: 0.132,
            LicenseScore: 1.000,
            LicenseScoreLatency: 0.155,
            GoodPinningPractice: 0.562,
            GoodPinningPracticeLatency: 0.170,
            PullRequest: 0.838,
            PullRequestLatency: 0.102,
        };

        const mockRow: PackageTableRow = {
            ID: '123',
            PackageName: 'test-package',
            Version: '1.0.0',
            Rating: mockRating,
            standaloneCost: 0.5,
        };

        (getPackageById as jest.Mock).mockResolvedValue(mockRow);

        const result = await handler(mockEvent);

        expect(result.statusCode).toBe(200);
        expect(JSON.parse(result.body)).toEqual(mockRating);
        expect(result.headers && result.headers['Content-Type']).toBe('application/json');
    });

    it('should return 500 if an error occurs', async () => {
        (getPackageById as jest.Mock).mockRejectedValue(new Error('DynamoDB Error'));
        const result = await handler(mockEvent);
        expect(result.statusCode).toBe(500);
    });
});
