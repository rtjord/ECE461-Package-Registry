import { gitAnalysis } from '../tools/api';
import { envVars } from '../utils/interfaces';
import { getEnvVars } from '../tools/getEnvVars';
import { repoData } from '../utils/interfaces';
import { gitData } from '../utils/interfaces';
// Mock Data for Testing
const url = "https://github.com/lodash/lodash"

const fakeRepoData: repoData = {
    repoName: '',
    repoUrl: url,
    repoOwner: '',
    numberOfContributors: -1,
    numberOfOpenIssues: -1,
    numberOfClosedIssues: -1,
    lastCommitDate: '',
    licenses: [],
    numberOfCommits: -1,
    dependencies: [],
    numberOfLines: -1,
    pullRequestMetrics: {
        totalAdditions: 0,
        reviewedAdditions: 0,
        reviewedFraction: 0
    },
    documentation: {
        hasReadme: false,
        numLines: -1,
        hasExamples: false,
        hasDocumentation: false,
        dependencies: {
            total: -1,
            fractionPinned: -1,
            pinned: -1
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

describe('gitAnalysisClass', () => {
    let gitAnalysisInstance: gitAnalysis;
    let envVars: envVars;

    beforeEach(() => {
        envVars = new getEnvVars();
        gitAnalysisInstance = new gitAnalysis(envVars);
    });

    // Test valid token
    it('should have a valid token', async () => {
        const result = await gitAnalysisInstance.isTokenValid();
        expect(result).toBe(true);
    }, 15000);

    // Test good connection
    it('should have a connection to the url', async () => {
        const result = await gitAnalysisInstance.checkConnection(url);
        expect(result).toBe(true);
    });

    // Test bad connection
    it('should not have a connection to the url', async () => {
        const result = await gitAnalysisInstance.checkConnection("https://github.com/fake/url");
        expect(result).toBe(false);
    });

    // Test finding owner and repo
    it('should find the owner and repo', async () => {
        await gitAnalysisInstance.getOwnerAndRepo(fakeRepoData);
        expect(fakeRepoData.repoName).not.toBe('');
        expect(fakeRepoData.repoOwner).not.toBe('');
    });

    //Test open issues
    it('should have a number of open issues', async () => {
        await gitAnalysisInstance.fetchOpenIssues(fakeRepoData);
        expect(fakeRepoData.numberOfOpenIssues).not.toBe(-1);
    });

    //Test closed issues
    it('should have a number of closed issues', async () => {
        await gitAnalysisInstance.fetchClosedIssues(fakeRepoData);
        expect(fakeRepoData.numberOfClosedIssues).not.toBe(-1);
    });

    //Test contributors
    it('should have a number of contributors', async () => {
        await gitAnalysisInstance.fetchContributors(fakeRepoData);
        expect(fakeRepoData.numberOfContributors).not.toBe(-1);
    });

    //Test licnese
    it('should have a license', async () => {
        await gitAnalysisInstance.fetchLicense(fakeRepoData);
        expect(fakeRepoData.licenses).not.toBe([]);
    });

    //Test number of commits
    it('should have a number of commits', async () => {
        await gitAnalysisInstance.fetchCommits(fakeRepoData);
        expect(fakeRepoData.numberOfCommits).not.toBe(-1);
    });

    //Test number of lines
    it('should have a number of lines', async () => {
        await gitAnalysisInstance.fetchLines(fakeRepoData);
        expect(fakeRepoData.numberOfLines).not.toBe(-1);
    });

    //Test runTasks
    it('should have a gitData with values', async () => {
        const result = await gitAnalysisInstance.runTasks(url);
        expect(result).not.toBe(fakeRepoData);
    }, 30000);

    // In gitAnalysis.test.ts

    describe('Pull Request Analysis', () => {
        let gitData: gitData;
    
        beforeEach(() => {
            gitData = {
                repoName: 'example-repo',
                repoUrl: 'https://github.com/example-owner/example-repo',
                repoOwner: 'example-owner',
                numberOfContributors: -1,
                numberOfOpenIssues: -1,
                numberOfClosedIssues: -1,
                pullRequestMetrics: {
                    totalAdditions: -1,
                    reviewedAdditions: -1,
                    reviewedFraction: -1,
                },
                licenses: [],
                numberOfCommits: -1,
                numberOfLines: -1,
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
                    dependencies: -1,
                },
            };
        });
    
        it('should calculate metrics for repositories with multiple pull requests', async () => {
            jest.spyOn((gitAnalysisInstance as any).axiosInstance, 'get')
                .mockImplementationOnce(() => Promise.resolve({ data: Array(2).fill({ number: 1, additions: 100 }) })) // PRs
                .mockImplementationOnce(() => Promise.resolve({ data: [{}] })) // Reviews for PR #1
                .mockImplementationOnce(() => Promise.resolve({ data: [{}] })); // Reviews for PR #2
    
            await gitAnalysisInstance.fetchPullRequests(gitData);
    
            expect(gitData.pullRequestMetrics).toEqual({
                totalAdditions: 200,
                reviewedAdditions: 200,
                reviewedFraction: 1.0,
            });
        });
    
        it('should handle repositories with no pull requests', async () => {
            jest.spyOn((gitAnalysisInstance as any).axiosInstance, 'get').mockResolvedValueOnce({ data: [] }); // No PRs
    
            await gitAnalysisInstance.fetchPullRequests(gitData);
    
            expect(gitData.pullRequestMetrics).toEqual({
                totalAdditions: 0,
                reviewedAdditions: 0,
                reviewedFraction: 0.0,
            });
        });
    
        it('should handle pull requests with no additions', async () => {
            jest.spyOn((gitAnalysisInstance as any).axiosInstance, 'get')
                .mockImplementationOnce(() => Promise.resolve({ data: [{ number: 1, additions: 0 }] })) // PRs
                .mockImplementationOnce(() => Promise.resolve({ data: [{}] })); // Reviews for PR #1
    
            await gitAnalysisInstance.fetchPullRequests(gitData);
    
            expect(gitData.pullRequestMetrics).toEqual({
                totalAdditions: 0,
                reviewedAdditions: 0,
                reviewedFraction: 0.0,
            });
        });
        
    
        it('should handle invalid API responses gracefully', async () => {
            jest.spyOn((gitAnalysisInstance as any).axiosInstance, 'get').mockRejectedValue(new Error('API Error'));
    
            await gitAnalysisInstance.fetchPullRequests(gitData);
    
            expect(gitData.pullRequestMetrics).toEqual({
                totalAdditions: 0,
                reviewedAdditions: 0,
                reviewedFraction: 0.0,
            });
        });
    
        it('should handle large repositories efficiently', async () => {
            const largePRs = Array.from({ length: 100 }, (_, i) => ({ number: i + 1, additions: i + 10 }));
        
            jest.spyOn((gitAnalysisInstance as any).axiosInstance, 'get')
                .mockImplementation((url) => {
                    if ((url as any).includes('/pulls')) {
                        return Promise.resolve({ data: largePRs }); // Mock PRs
                    }
                    if ((url as any).includes('/reviews')) {
                        const prNumber = parseInt((url as string).split('/').slice(-2, -1)[0], 10); // Extract PR number
                        return Promise.resolve({
                            data: prNumber % 2 === 0 ? [{}] : [], // Even PRs are reviewed
                        });
                    }
                    return Promise.resolve({ data: [] }); // Default response
                });
        
            await gitAnalysisInstance.fetchPullRequests(gitData);
        
            const totalAdditions = largePRs.reduce((sum, pr) => sum + pr.additions, 0);
            const reviewedAdditions = largePRs
                .filter((_, i) => (i + 1) % 2 === 0) // Only even-indexed PRs are reviewed
                .reduce((sum, pr) => sum + pr.additions, 0);
        
            expect(gitData.pullRequestMetrics).toEqual({
                totalAdditions,
                reviewedAdditions,
                reviewedFraction: reviewedAdditions / totalAdditions,
            });
        });
        
    });
    
    

});
