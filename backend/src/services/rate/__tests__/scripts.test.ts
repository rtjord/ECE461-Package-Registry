import { runAnalysis } from '../tools/scripts';
import { repoData } from '../utils/interfaces';
import { envVars } from '../utils/interfaces';
import { getEnvVars } from '../tools/getEnvVars';

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
        expect(result).not.toBe([fakeRepoData]);
    }, 15000);

    // Test run analysis with bad url
    it('should have a valid token', async () => {
        const result = await runAnalysisInstance.runAnalysis(["https://pypi.org/"]);
        expect(result).toStrictEqual([fakeWrongRepoData]);
    });
});