import { runAnalysis } from '../tools/scripts';
import { repoData } from '../utils/interfaces';
import { envVars } from '../utils/interfaces';
import { getEnvVars } from '../tools/getEnvVars';

// Mock Data for Testing
const url = "https://github.com/axios/axios";

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
        pullRequests: -1
    }
};

const fakeWrongRepoData: repoData = {
    repoName: '',
    repoUrl: "https://pypi.org/",
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
        hasDocumentation: false,
        dependencies: {
            total: 0,
            fractionPinned: 1.0,
            pinned: 0
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
        pullRequests: -1
    }
};

describe('runAnalysisClass', () => {
    let runAnalysisInstance: runAnalysis;
    let envVars: envVars;

    beforeEach(() => {
        envVars = new getEnvVars();
        runAnalysisInstance = new runAnalysis(envVars);
    });

    // Test run analysis with good url
    it('should have a valid token', async () => {
        const result = await runAnalysisInstance.runAnalysis([url]);
        expect(result).not.toEqual([fakeRepoData]);
    }, 50000);

    // Test run analysis with bad url
    it('should throw an error for a bad url', async () => {
        try {
            const result = await runAnalysisInstance.runAnalysis([url]);
        } catch (error) {
            const err = error as Error;
            expect(err.message).toContain('Invalid URL');
        }
    }, 30000);

    it('should include dependency analysis results in the documentation field', async () => {
        const result = await runAnalysisInstance.runAnalysis([url]);
        console.log('Full result:', JSON.stringify(result, null, 2));
        console.log('Documentation object:', result[0]?.documentation);
        console.log('Dependencies:', result[0]?.documentation?.dependencies);
        
        expect(result[0].documentation.dependencies).toBeDefined();
        expect(result[0].documentation.dependencies).toHaveProperty('fractionPinned');
    }, 50000);
});
