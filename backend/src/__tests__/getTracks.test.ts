import { handler } from '../handlers/GetTracks';
import { APIGatewayProxyEvent } from 'aws-lambda';

describe('Lambda Handler Tests', () => {
  it('should return 200 with the planned tracks', async () => {
    const mockEvent: APIGatewayProxyEvent = {
      body: null,
      headers: {},
      multiValueHeaders: {},
      httpMethod: 'GET',
      isBase64Encoded: false,
      path: '/tracks',
      pathParameters: null,
      queryStringParameters: null,
      multiValueQueryStringParameters: null,
      stageVariables: null,
      requestContext: {} as any,
      resource: ''
    };

    const response = await handler(mockEvent);

    expect(response.statusCode).toBe(200);
    expect(response.headers && response.headers['Content-Type']).toBe('application/json');
    expect(response.body).toBeDefined();

    const body = JSON.parse(response.body);
    expect(body.plannedTracks).toEqual(['ML inside track']);
  });

  it('should return 500 if an error occurs', async () => {
    const mockEvent: APIGatewayProxyEvent = {
      body: null,
      headers: {},
      multiValueHeaders: {},
      httpMethod: 'GET',
      isBase64Encoded: false,
      path: '/tracks',
      pathParameters: null,
      queryStringParameters: null,
      multiValueQueryStringParameters: null,
      stageVariables: null,
      requestContext: {} as any,
      resource: ''
    };

    // Mocking the handler to throw an error
    jest.spyOn(JSON, 'stringify').mockImplementationOnce(() => {
        throw new Error('Mocked error');
    });
      
    const response = await handler(mockEvent);

    expect(response.statusCode).toBe(500);
    expect(response.headers && response.headers['Content-Type']).toBe('application/json');
    expect(response.body).toBeDefined();

    const body = JSON.parse(response.body);
    expect(body.message).toBe("The system encountered an error while retrieving the student's track information.");

    jest.restoreAllMocks();
  });
});
