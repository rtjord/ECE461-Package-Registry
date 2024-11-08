import { urlAnalysis } from '../tools/urlOps';
import * as https from 'https';
import { logger } from '../tools/logging';
import { envVars } from '../utils/interfaces';

jest.mock('fs');
jest.mock('https');
jest.mock('readline');
jest.mock('../tools/logging');

describe('urlAnalysis', () => {
    let analysis: urlAnalysis;
    let mockLogger: jest.Mocked<logger>;
    const mockEnvVars: envVars = { token: 'test',
        logLevel: 1,
        logFilePath: './testDir/test.log'
      };

    beforeEach(() => {
        jest.clearAllMocks();
        mockLogger = new logger(mockEnvVars) as jest.Mocked<logger>;
        analysis = new urlAnalysis(mockEnvVars);
        analysis['logger'] = mockLogger;
    });

    describe('evalUrl', () => {
        it('should return the cleaned GitHub URL if it matches the pattern', async () => {
            const url = 'https://github.com/expressjs/express';
            const result = await analysis.evalUrl(url);
            expect(result).toEqual([0, 'https://github.com/expressjs/express']);
        });

        it('should call getRepositoryUrl if it matches the npm pattern', async () => {
            const url = 'https://www.npmjs.com/package/express';
            const mockRepoUrl = 'https://github.com/expressjs/express';
            jest.spyOn(analysis, 'getRepositoryUrl').mockResolvedValue(mockRepoUrl);

            const result = await analysis.evalUrl(url);
            expect(result).toEqual([0, mockRepoUrl]);
            expect(analysis.getRepositoryUrl).toHaveBeenCalledWith(url);
        });

        it('should return -1 and an empty string if the URL does not match any pattern', async () => {
            const url = 'https://example.com/invalid-url';
            const result = await analysis.evalUrl(url);
            expect(result).toEqual([-1, '']);
        });

        it('should return -1 and an empty string if getRepositoryUrl fails', async () => {
            const url = 'https://www.npmjs.com/package/some-package';
            jest.spyOn(analysis, 'getRepositoryUrl').mockRejectedValue(new Error('Error fetching repository URL'));

            const result = await analysis.evalUrl(url);
            expect(result).toEqual([-1, '']);
            expect(mockLogger.logDebug).toHaveBeenCalledWith('Error fetching repository URL:', expect.any(Error));
        });
    });

    describe('extractPackageName', () => {
        it('should return the package name from a valid npm URL', () => {
            const url = 'https://www.npmjs.com/package/some-package';
            const result = analysis.extractPackageName(url);
            expect(result).toBe('some-package');
        });

        it('should return null for an invalid npm URL', () => {
            const url = 'https://example.com/invalid-url';
            const result = analysis.extractPackageName(url);
            expect(result).toBeNull();
            expect(mockLogger.logDebug).toHaveBeenCalledWith('Invalid npm package URL');
        });
    });

    describe('getRepositoryUrl', () => {
        it('should return the cleaned repository URL from the NPM registry', async () => {
            const mockUrl = 'https://www.npmjs.com/package/express';
            const mockResponse = JSON.stringify({
                repository: { url: 'git+https://github.com/expressjs/express.git' }
            });
    
            // Mock the https.get call
            (https.get as jest.Mock).mockImplementation((url, callback) => {
                const res = {
                    on: jest.fn().mockImplementation((event, handler) => {
                        if (event === 'data') {
                            handler(mockResponse); // Provide mock response data
                        }
                        if (event === 'end') {
                            handler(); // End event
                        }
                    })
                } as unknown;
                callback(res);
                return { on: jest.fn() }; // Simulate request.on('error')
            });
    
            const analysis = new urlAnalysis(mockEnvVars);
            const result = await analysis.getRepositoryUrl(mockUrl);
            expect(result).toBe('https://github.com/expressjs/express');
        });
    });
});