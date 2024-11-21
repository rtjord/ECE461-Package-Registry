import { handler } from '../CreateAuthToken';
import { APIGatewayProxyEvent } from 'aws-lambda';

describe('Lambda Handler Tests', () => {
  it('should return 501', async () => {
    const mockEvent: APIGatewayProxyEvent = {
      body: null,
      headers: {},
      multiValueHeaders: {},
      httpMethod: 'PUT',
      isBase64Encoded: false,
      path: '/authenticate',
      pathParameters: null,
      queryStringParameters: null,
      multiValueQueryStringParameters: null,
      stageVariables: null,
      requestContext: {} as APIGatewayProxyEvent['requestContext'],
      resource: ''
    };

    const response = await handler(mockEvent);

    expect(response.statusCode).toBe(501);
    expect(response.headers && response.headers['Content-Type']).toBe('application/json');
    expect(response.body).toBeDefined();

    const body = JSON.parse(response.body);
    expect(body.message).toEqual('This system does not support authentication.');
  });
});
