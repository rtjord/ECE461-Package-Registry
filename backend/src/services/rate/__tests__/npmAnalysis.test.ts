import { npmAnalysis } from '../tools/api';
import * as fs from 'fs/promises';
import * as git from 'isomorphic-git';
import { logger } from '../tools/logging';
import { envVars, npmData } from '../utils/interfaces';

jest.mock('fs/promises');
jest.mock('isomorphic-git');
jest.mock('../tools/logging');

describe('npmAnalysis', () => {
    let analysis: npmAnalysis;
    let mockLogger: jest.Mocked<logger>;
    const mockEnvVars: envVars = { token: 'test',
                                   logLevel: 1,
                                   logFilePath: './testDir/test.log'
                                 };

    beforeEach(() => {
        mockLogger = new logger(mockEnvVars) as jest.Mocked<logger>;
        analysis = new npmAnalysis(mockEnvVars);
        analysis['logger'] = mockLogger;
    });

    describe('cloneRepo', () => {
        it('should log and return if directory already exists', async () => {
            (fs.access as jest.Mock).mockResolvedValue(undefined);

            await analysis.cloneRepo('https://example.com/repo.git', './repo');

            expect(mockLogger.logInfo).toHaveBeenCalledWith('Repository already exists in directory: ./repo');
        });

        it('should log debug and clone repo if directory does not exist', async () => {
            (fs.access as jest.Mock).mockRejectedValue(new Error('Directory does not exist'));
            (git.clone as jest.Mock).mockResolvedValue(undefined);

            await analysis.cloneRepo('https://example.com/repo.git', './repo');

            expect(mockLogger.logDebug).toHaveBeenCalledWith('Directory does not exist, proceeding to clone...');
            expect(mockLogger.logInfo).toHaveBeenCalledWith('Cloning repository...');
            expect(git.clone).toHaveBeenCalledWith({
                fs,
                http: expect.anything(),
                dir: './repo',
                url: 'https://example.com/repo.git',
                singleBranch: true,
            });
            expect(mockLogger.logInfo).toHaveBeenCalledWith(`Repository https://example.com/repo.git cloned in directory ./repo.`);
        });
    });

    describe('getReadmeContent', () => {
        const mockNpmData: npmData = {
            repoUrl: 'https://example.com/repo',
            lastCommitDate: '',
            documentation: {
                hasReadme: false,
                numLines: -1,
                hasExamples: false,
                hasDocumentation: false
            },
            latency: {
                contributors: -1,
                openIssues: -1,
                closedIssues: -1,
                lastCommitDate: -1,
                licenses: -1,
                numberOfCommits: -1,
                numberOfLines: -1,
                documentation: -1
            }
        };

        it('should log debug message when no README file is found', async () => {
            (git.resolveRef as jest.Mock).mockResolvedValue('mockOid');
            (git.readTree as jest.Mock).mockResolvedValue({ tree: [] }); // No README file

            await analysis.getReadmeContent('./repo', mockNpmData);

            expect(mockLogger.logInfo).toHaveBeenCalledWith('No README file found in the repository tree. Trying to fetch via package URL...');
        });

        it('should update npmData when README file is found', async () => {
            (git.resolveRef as jest.Mock).mockResolvedValue('mockOid');
            (git.readTree as jest.Mock).mockResolvedValue({
                tree: [{ path: 'README.md', oid: 'mockOid' }]
            });
            (git.readBlob as jest.Mock).mockResolvedValue({ blob: Buffer.from('Examples README content\nDocs\n') });

            await analysis.getReadmeContent('./repo', mockNpmData);

            expect(mockNpmData.documentation.hasReadme).toBe(true);
            expect(mockNpmData.documentation.numLines).toBe(3);
            expect(mockNpmData.documentation.hasExamples).toBe(true);
            expect(mockNpmData.documentation.hasDocumentation).toBe(true);
        });
    });

    describe('lastCommitDate', () => {
        const mockNpmData: npmData = {
            repoUrl: 'https://example.com/repo',
            lastCommitDate: '',
            documentation: {
                hasReadme: false,
                numLines: -1,
                hasExamples: false,
                hasDocumentation: false
            },
            latency: {
                contributors: -1,
                openIssues: -1,
                closedIssues: -1,
                lastCommitDate: -1,
                licenses: -1,
                numberOfCommits: -1,
                numberOfLines: -1,
                documentation: -1
            }
        };

        it('should update npmData with the last commit date', async () => {
            const mockCommit = {
                commit: {
                    author: { timestamp: 1627857380 }
                }
            };
            (git.log as jest.Mock).mockResolvedValue([mockCommit]);

            await analysis.lastCommitDate('./repo', mockNpmData);

            expect(mockNpmData.lastCommitDate).toBe('Sun Aug 01 2021');
            expect(mockLogger.logDebug).toHaveBeenCalledWith('Finding time since last commit...');
        });

        it('should log debug message if no commits are found', async () => {
            (git.log as jest.Mock).mockResolvedValue([]);

            await analysis.lastCommitDate('./repo', mockNpmData);

            expect(mockLogger.logDebug).toHaveBeenCalledWith(`No commits found in the repository ${mockNpmData.repoUrl} in dir ./repo`);
        });
    });

    describe('deleteRepo', () => {
        it('should delete the repository', async () => {
            (fs.rm as jest.Mock).mockResolvedValue(undefined);

            await analysis.deleteRepo('./repo');

            expect(fs.rm).toHaveBeenCalledWith('./repo', { recursive: true, force: true });
            expect(mockLogger.logDebug).toHaveBeenCalledWith('Repository in ./repo deleted');
        });

        it('should log debug message if deletion fails', async () => {
            (fs.rm as jest.Mock).mockRejectedValue(new Error('Failed to delete'));

            await analysis.deleteRepo('./repo');

            expect(mockLogger.logDebug).toHaveBeenCalledWith('Failed to delete repository in ./repo:');
        });
    });
});
