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

            await analysis.cloneRepo('https://example.com/repo.git', './repo', '');

            expect(mockLogger.logInfo).toHaveBeenCalledWith('Repository already exists in directory: ./repo');
        });

        it('should log debug and clone repo if directory does not exist', async () => {
            (fs.access as jest.Mock).mockRejectedValue(new Error('Directory does not exist'));
            (git.clone as jest.Mock).mockResolvedValue(undefined);

            await analysis.cloneRepo('https://example.com/repo.git', './repo', '');

            expect(mockLogger.logDebug).toHaveBeenCalledWith('Directory does not exist, proceeding to clone...');
            expect(mockLogger.logInfo).toHaveBeenCalledWith('Cloning repository...');
            // expect(git.clone).toHaveBeenCalledWith({
            //     fs,
            //     http: expect.anything(),
            //     dir: './repo',
            //     url: 'https://example.com/repo.git',
            //     singleBranch: true,
            // });
            expect(mockLogger.logInfo).toHaveBeenCalledWith(`Repository https://example.com/repo.git cloned in directory ./repo.`);
        });
    });

    describe('getReadmeContent', () => {
        const mockNpmData: npmData = {
            repoUrl: 'https://example.com/repo',
            lastCommitDate: '',
            dependencies: [],
            documentation: {
                hasReadme: false,
                numLines: -1,
                hasExamples: false,
                hasDocumentation: false,
                dependencies: {
                    total: 0,
                    fractionPinned: 1.0,
                    pinned: 0,
                }
            },
            latency: {
                contributors: -1,
                openIssues: -1,
                closedIssues: -1,
                lastCommitDate: -1,
                licenses: -1,
                numberOfCommits: -1,
                numberOfLines: -1,
                documentation: -1,
                pullRequests: -1,
                dependencies: -1
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
            dependencies: [],
            documentation: {
                hasReadme: false,
                numLines: -1,
                hasExamples: false,
                hasDocumentation: false,
                dependencies: {
                    total: 0,
                    fractionPinned: 1.0,
                    pinned: 0,
                }
            },
            latency: {
                contributors: -1,
                openIssues: -1,
                closedIssues: -1,
                lastCommitDate: -1,
                licenses: -1,
                numberOfCommits: -1,
                numberOfLines: -1,
                documentation: -1,
                pullRequests: -1,
                dependencies: -1
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
    describe('analyzeDependencies', () => {
        let dir: string;
        let npmData: npmData;
    
        beforeEach(() => {
            dir = './testRepo';
            npmData = {
                repoUrl: 'https://github.com/example/repo',
                lastCommitDate: '',
                dependencies: [],
                documentation: {
                    hasReadme: true,
                    numLines: 100,
                    hasExamples: false,
                    hasDocumentation: true,
                    dependencies: {
                        total: -1,
                        fractionPinned: -1,
                        pinned: -1,
                    },
                },
                latency: {
                    contributors: -1,
                    openIssues: -1,
                    closedIssues: -1,
                    lastCommitDate: -1,
                    licenses: -1,
                    numberOfCommits: -1,
                    numberOfLines: -1,
                    documentation: -1,
                    dependencies: -1,
                    pullRequests: -1,
                },
            };
        });
    
        it('should calculate pinned dependency fraction correctly', async () => {
            jest.spyOn(fs, 'readFile').mockResolvedValue(JSON.stringify({
                dependencies: {
                    'dep1': '1.0.0', // Pinned
                    'dep2': '2.3.x', // Unpinned
                    'dep5': ''
                },
                devDependencies: {
                    'dep3': '^1.2.3', // Unpinned
                    'dep4': '1.2.5',  // Pinned
                },
            }));
    
            const instance = new npmAnalysis(mockEnvVars);
            await instance.analyzeDependencies(dir, npmData);
    
            expect(npmData.documentation.dependencies).toEqual({
                total: 5,
                pinned: 2,
                fractionPinned: 0.4,
            });
        });
    
        it('should handle missing package.json gracefully', async () => {
            jest.spyOn(fs, 'readFile').mockRejectedValue(new Error('File not found'));
    
            const instance = new npmAnalysis(mockEnvVars);
            await instance.analyzeDependencies(dir, npmData);
    
            expect(npmData.documentation.dependencies).toEqual({
                total: 0,
                pinned: 0,
                fractionPinned: 1.0, // No dependencies means perfect pinning
            });
        });
    
        it('should handle malformed package.json gracefully', async () => {
            jest.spyOn(fs, 'readFile').mockResolvedValue('invalid json');
    
            const instance = new npmAnalysis(mockEnvVars);
            await instance.analyzeDependencies(dir, npmData);
    
            expect(npmData.documentation.dependencies).toEqual({
                total: 0,
                pinned: 0,
                fractionPinned: 1.0, // Treat as no dependencies
            });
        });
    
        it('should handle large numbers of dependencies efficiently', async () => {
            const largeDependencies: { [key: string]: string } = {};
            for (let i = 0; i < 1000; i++) {
                largeDependencies[`dep${i}`] = i % 2 === 0 ? '1.0.0' : '^1.0.0'; // Alternate pinned/unpinned
            }
    
            jest.spyOn(fs, 'readFile').mockResolvedValue(JSON.stringify({ dependencies: largeDependencies }));
    
            const instance = new npmAnalysis(mockEnvVars);
            await instance.analyzeDependencies(dir, npmData);
    
            expect(npmData.documentation.dependencies.total).toEqual(1000);
            expect(npmData.documentation.dependencies.pinned).toEqual(500); // 50% pinned
            expect(npmData.documentation.dependencies.fractionPinned).toBeCloseTo(0.5, 2);
        });
    
        it('should handle empty dependencies object gracefully', async () => {
            jest.spyOn(fs, 'readFile').mockResolvedValue(JSON.stringify({
                dependencies: {},
                devDependencies: {},
            }));
    
            const instance = new npmAnalysis(mockEnvVars);
            await instance.analyzeDependencies(dir, npmData);
    
            expect(npmData.documentation.dependencies).toEqual({
                total: 0,
                pinned: 0,
                fractionPinned: 1.0, // No dependencies means perfect pinning
            });
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
