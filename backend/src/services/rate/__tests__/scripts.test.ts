import { runAnalysis } from '../tools/scripts';
import { repoData } from '../utils/interfaces';
import { envVars } from '../utils/interfaces';
import { getEnvVars } from '../tools/getEnvVars';
import { npmAnalysis } from '../tools/api';

// Mock Data for Testing
const url = "https://github.com/bendrucker/smallest";

const fakeRepoData: repoData = {
    repoName: '',
    repoUrl: url,
    repoOwner: '',
    numberOfContributors: -1,
    numberOfOpenIssues: -1,
    numberOfClosedIssues: -1,
    lastCommitDate: '',
    licenses: [],
    dependencies: [],
    numberOfCommits: -1,
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

describe('runAnalysisClass', () => {
    let runAnalysisInstance: runAnalysis;
    let envVars: envVars;

    beforeEach(() => {
        envVars = new getEnvVars();
        runAnalysisInstance = new runAnalysis(envVars);
    });

    // Test basic runAnalysis functionality with a valid URL
    it('should populate all fields in repoData for a valid URL', async () => {
        const result = await runAnalysisInstance.runAnalysis([url]);
        const analyzedRepo = result[0];

        expect(analyzedRepo).toBeDefined();
        expect(analyzedRepo.repoName).not.toBe('');
        expect(analyzedRepo.repoOwner).not.toBe('');
        expect(analyzedRepo.numberOfContributors).toBeGreaterThanOrEqual(0);
        expect(analyzedRepo.numberOfOpenIssues).toBeGreaterThanOrEqual(0);
        expect(analyzedRepo.numberOfClosedIssues).toBeGreaterThanOrEqual(0);
        expect(analyzedRepo.pullRequestMetrics).toHaveProperty('totalAdditions');
        expect(analyzedRepo.pullRequestMetrics).toHaveProperty('reviewedAdditions');
        expect(analyzedRepo.pullRequestMetrics).toHaveProperty('reviewedFraction');
        expect(analyzedRepo.documentation.dependencies).toHaveProperty('total');
        expect(analyzedRepo.documentation.dependencies).toHaveProperty('fractionPinned');
    },30000);



    

    // // Test multiple repositories in parallel
    // it('should analyze multiple repositories in parallel', async () => {
    //     const urls = [
    //         "https://github.com/axios/axios",
    //         "https://github.com/facebook/react",
    //         "https://github.com/microsoft/TypeScript"
    //     ];

    //     const results = await runAnalysisInstance.runAnalysis(urls);

    //     expect(results.length).toEqual(urls.length);
    //     results.forEach(repo => {
    //         expect(repo.repoName).not.toBe('');
    //         expect(repo.repoOwner).not.toBe('');
    //         expect(repo.documentation.dependencies).toBeDefined();
    //     });
    // });

    // // Test handling of API errors gracefully
    // it('should handle API errors and return default repoData', async () => {
    //     jest.spyOn((runAnalysisInstance as any), 'fetchGitHubData').mockRejectedValue(new Error('API Error'));

    //     const result = await (runAnalysisInstance as any).runAnalysis([url]);
    //     expect(result[0]).toEqual(fakeRepoData); // Ensure default repoData is returned
    // });
});
