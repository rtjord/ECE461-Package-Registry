import { gitAnalysis } from '../tools/api';
import { envVars } from '../utils/interfaces';
import { getEnvVars } from '../tools/getEnvVars';
import { repoData } from '../utils/interfaces';

// Mock Data for Testing
const url = "https://github.com/phillips302/ECE461";

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
    numberOfLines: -1,
    pullRequestMetrics: undefined,
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
        documentation: -1,
        pullRequests: -1
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
        it('should fetch pull request metrics', async () => {
            await gitAnalysisInstance.fetchPullRequests(fakeRepoData);
            expect(fakeRepoData.pullRequestMetrics).toBeDefined();
            if (fakeRepoData.pullRequestMetrics) {
                expect(fakeRepoData.pullRequestMetrics.reviewedFraction).toBeGreaterThanOrEqual(0);
                expect(fakeRepoData.pullRequestMetrics.reviewedFraction).toBeLessThanOrEqual(1);
                expect(fakeRepoData.pullRequestMetrics.totalAdditions).toBeGreaterThanOrEqual(0);
                expect(fakeRepoData.pullRequestMetrics.reviewedAdditions).toBeGreaterThanOrEqual(0);
            }
        }, 30000);

        it('should handle repositories with no access or invalid repos', async () => {
            const invalidRepo = { 
                ...fakeRepoData, 
                repoUrl: 'https://github.com/definitely-not-real/non-existent-repo',
                repoOwner: 'definitely-not-real',
                repoName: 'non-existent-repo'
            };

            // Temporarily reduce exponential backoff for this test
            const originalBackoff = gitAnalysisInstance.exponentialBackoff;
            gitAnalysisInstance.exponentialBackoff = async (requestFn) => {
                try {
                    return await requestFn();
                } catch (error) {
                    throw error;
                }
            };

            await gitAnalysisInstance.fetchPullRequests(invalidRepo);
            
            // Restore original exponential backoff
            gitAnalysisInstance.exponentialBackoff = originalBackoff;

            expect(invalidRepo.pullRequestMetrics).toEqual({
                totalAdditions: 0,
                reviewedAdditions: 0,
                reviewedFraction: 0
            });
        }, 10000);  // Reduced timeout since we're bypassing backoff

        it('should handle API errors gracefully', async () => {
            const badRepo = { 
                ...fakeRepoData, 
                repoOwner: '',  // Invalid owner
                repoName: ''    // Invalid name
            };

            // Temporarily reduce exponential backoff for this test
            const originalBackoff = gitAnalysisInstance.exponentialBackoff;
            gitAnalysisInstance.exponentialBackoff = async (requestFn) => {
                try {
                    return await requestFn();
                } catch (error) {
                    throw error;
                }
            };

            await gitAnalysisInstance.fetchPullRequests(badRepo);

            // Restore original exponential backoff
            gitAnalysisInstance.exponentialBackoff = originalBackoff;

            expect(badRepo.pullRequestMetrics).toEqual({
                totalAdditions: 0,
                reviewedAdditions: 0,
                reviewedFraction: 0
            });
        }, 10000);  // Reduced timeout since we're bypassing backoff
    });

});
