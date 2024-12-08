import { repoData } from '../utils/interfaces';
import { metricCalc } from '../tools/metricCalc';
import { DependencyFailureException } from '@aws-sdk/client-opensearch';

// Mock Data for testing with vaild data
const fakeRepoData: repoData = {
    repoName: 'example-repo',
    dependencies: [],
    repoUrl: 'https://github.com/example-repo',
    repoOwner: 'example-owner',
    numberOfContributors: 400,
    numberOfOpenIssues: 10,
    numberOfClosedIssues: 20,
    lastCommitDate: "Sat Nov 09 2024",
    licenses: [''],
    numberOfCommits: 1200,
    numberOfLines: 600,
    pullRequestMetrics: {
        totalAdditions: 1000,
        reviewedAdditions: 800,
        reviewedFraction: 0.8
    },
    documentation: {
        hasReadme: true,
        numLines: 1000,
        hasExamples: true,
        hasDocumentation: true,
        dependencies: {
            total: 0,
            fractionPinned: 1.0,
            pinned: 0,
        }
    },
    latency: {
        contributors: 0,
        openIssues: 0,
        closedIssues: 0,
        lastCommitDate: 0,
        licenses: 0,
        numberOfCommits: 0,
        numberOfLines: 0,
        documentation: 0,
        pullRequests: 0,
        dependencies  : 0
    }
};

// Mock testing for testing with invalid Data
const invalidData: repoData = {
    repoName: 'example-repo',
    repoUrl: 'https://github.com/example-repo',
    dependencies : [],
    repoOwner: 'example-owner',
    numberOfContributors: -1,
    numberOfOpenIssues: -1,
    numberOfClosedIssues: -1,
    lastCommitDate: '',
    licenses: [''],
    numberOfCommits: -1,
    numberOfLines: -1,
    pullRequestMetrics: {
        totalAdditions: -1,
        reviewedAdditions: -1,
        reviewedFraction: -1
    },
    documentation: {
        hasReadme: false,
        numLines: -1,
        hasExamples: false,
        hasDocumentation: false,
        dependencies: {
            total: -1,
            fractionPinned: -1,
            pinned: -1,
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

describe('metricCalcClass', () => {
    let metricClass: metricCalc;

    beforeEach(() => {
        // Initialize the class with fakeRepoData
        metricClass = new metricCalc();
    });

    // Test the correctness calculation with valid data
    it('Calculate correctness metric with issues ratio under 0.5', () => {
        const correctness = metricClass.calculateCorrectness(fakeRepoData);
        expect(correctness).toEqual(1); // Update the expected value based on your formula
    });

    it('Calculate correctness metric with issues ratio over 1', () => {
        fakeRepoData.numberOfOpenIssues = 40;
        const correctness = metricClass.calculateCorrectness(fakeRepoData);
        expect(correctness).toEqual(0); // Update the expected value based on your formula
    });

    it('Calculate correctness metric with zero closed issues', () => {
        fakeRepoData.numberOfClosedIssues = 0;
        const correctness = metricClass.calculateCorrectness(fakeRepoData);
        expect(correctness).toEqual(0); // Update the expected value based on your formula
    });

    it('Calculate correctness metric with issues ratio over 0.5', () => {
        fakeRepoData.numberOfClosedIssues = 20;
        fakeRepoData.numberOfOpenIssues = 15;
        const correctness = metricClass.calculateCorrectness(fakeRepoData);
        expect(correctness).toBeLessThan(1); // Update the expected value based on your formula
        expect(correctness).toBeGreaterThan(0);
    });

    //Test the correctness calculation with invalid data
    it('Calculate correctness metric with invalid data', () => {
        const correctness = metricClass.calculateCorrectness(invalidData);
        expect(correctness).toEqual(0); //returns zero when score can not be calculated
    });

    // Test the bus factor calculation with valid data
    it('Calculate bus factor with contributors input over 200', () => {
        const busFactor = metricClass.calculateBusFactor(fakeRepoData);
        expect(busFactor).toEqual(1);
    });

    it('Calculate bus factor with contributors input between 100 and 200', () => {
        fakeRepoData.numberOfContributors = 150;
        const busFactor = metricClass.calculateBusFactor(fakeRepoData);
        expect(busFactor).toEqual(0.75);
    });

    it('Calculate bus factor with contributors input between 50 and 100', () => {
        fakeRepoData.numberOfContributors = 75;
        const busFactor = metricClass.calculateBusFactor(fakeRepoData);
        expect(busFactor).toEqual(0.5);
    });

    it('Calculate bus factor with contributors input between 15 and 50', () => {
        fakeRepoData.numberOfContributors = 30;
        const busFactor = metricClass.calculateBusFactor(fakeRepoData);
        expect(busFactor).toEqual(0.25);
    });

    it('Calculate bus factor with contributors input between 0 and 15', () => {
        fakeRepoData.numberOfContributors = 10;
        const busFactor = metricClass.calculateBusFactor(fakeRepoData);
        expect(busFactor).toEqual(0);
    });

    //Test bus factor with invalid data
    it('Calculate bus factor with invalid data', () => {
        const busFactor = metricClass.calculateBusFactor(invalidData);
        expect(busFactor).toEqual(0); //returns zero when score can not be calculated
    });

    // Test the ramp-up calculation with valid data
    it('Calculate ramp-up with valid inputs', () => {
        const rampup = metricClass.calculateRampup(fakeRepoData);
        expect(rampup).toEqual(1);
    });

    it('Calculate ramp-up with valid inputs', () => {
        fakeRepoData.documentation.hasReadme = false;
        const rampup = metricClass.calculateRampup(fakeRepoData);
        expect(rampup).toEqual(0.66); 
    });
    
    it('Calculate ramp-up with valid inputs', () => {
        fakeRepoData.documentation.hasReadme = true;
        fakeRepoData.documentation.numLines = 100;
        const rampup = metricClass.calculateRampup(fakeRepoData);
        expect(rampup).toEqual(0.9); 
    });

    it('Calculate ramp-up with valid inputs', () => {
        fakeRepoData.documentation.hasExamples = false;
        const rampup = metricClass.calculateRampup(fakeRepoData);
        expect(rampup).toEqual(0.8); 
    });

    it('Calculate ramp-up with valid inputs', () => {
        fakeRepoData.documentation.hasDocumentation = false;
        const rampup = metricClass.calculateRampup(fakeRepoData);
        expect(rampup).toEqual(0.66); 
    });

    it('Calculate ramp-up with valid inputs', () => {
        fakeRepoData.numberOfLines = 400;
        const rampup = metricClass.calculateRampup(fakeRepoData);
        expect(rampup).toEqual(0.33); 
    });

    it('Calculate ramp-up with valid inputs', () => {
        fakeRepoData.numberOfCommits = 200;
        const rampup = metricClass.calculateRampup(fakeRepoData);
        expect(rampup).toEqual(0); 
    });

    //Test the ramp-up calculation with invalid data
    it('Calculate ramp-up with invalid inputs', () => {
        const rampup = metricClass.calculateRampup(invalidData);
        expect(rampup).toEqual(0);
    });

    // Test the responsiveness calculation with valid data
    it('Calculate responsiveness with valid inputs', () => {
        const responsiveness = metricClass.calculateResponsiveness(fakeRepoData);
        expect(responsiveness).toBeGreaterThan(0);
    });

    //Test the responsiveness calculation with invalid data
    it('Calculate responsiveness with invalid inputs', () => {
        const responsiveness = metricClass.calculateResponsiveness(invalidData);
        expect(responsiveness).toEqual(0); 
    });

    // Test the license existence check
    it('Calculate license existence with invalid inputs', () => {
        const licenseExistence = metricClass.checkLicenseExistence(invalidData);
        expect(licenseExistence).toEqual(0); // Blank license should equal 0
    });

    it('Calculate license existence with valid inputs', () => {
        fakeRepoData.licenses = ['MIT'];
        const licenseExistence = metricClass.checkLicenseExistence(fakeRepoData);
        expect(licenseExistence).toEqual(1); // MIT License should pass
    });

    it('Calculate license existence with valid inputs', () => {
        fakeRepoData.licenses = ['BSD-3-Clause'];
        const licenseExistence = metricClass.checkLicenseExistence(fakeRepoData);
        expect(licenseExistence).toEqual(1); // License should pass
    });

    it('Calculate license existence with valid inputs', () => {
        fakeRepoData.licenses = ['Apache-2.0'];
        const licenseExistence = metricClass.checkLicenseExistence(fakeRepoData);
        expect(licenseExistence).toEqual(1); // License should pass
    });

    it('Calculate license existence with valid inputs', () => {
        fakeRepoData.licenses = ['LGPL-2.1'];
        const licenseExistence = metricClass.checkLicenseExistence(fakeRepoData);
        expect(licenseExistence).toEqual(1); // License should pass
    });

    // Test the net score calculation
    it('Calculate net score with valid inputs', () => {
        const netScore = metricClass.calculateNetScore(fakeRepoData); // Use arbitrary values for the test
        expect(netScore).toBeGreaterThan(0);
        expect(netScore).toBeLessThan(1);
    });

    //Test the net score calculation with invalid data
    it('Calculate net score with invalid inputs', () => {
        const netScore = metricClass.calculateNetScore(invalidData); // Use arbitrary values for the test
        expect(netScore).toEqual(0);
    });

    describe('Pinned Dependencies', () => {
        beforeEach(() => {
            fakeRepoData.documentation.dependencies = {
                total: 3,
                pinned: 2,
                fractionPinned: 2 / 3,
            };
        });
    
        it('should correctly return the precomputed fractionPinned value', () => {
            const pinnedDependencies = metricClass.calculatePinnedDependencies(fakeRepoData);
            expect(pinnedDependencies).toEqual(.667);
        });
    
        it('should return 1.0 if no dependencies exist', () => {
            fakeRepoData.documentation.dependencies = {
                total: 0,
                pinned: 0,
                fractionPinned: 1.0,
            };
            const pinnedDependencies = metricClass.calculatePinnedDependencies(fakeRepoData);
            expect(pinnedDependencies).toEqual(1.0);
        });
    
        it('should return 0 if all dependencies are unpinned', () => {
            fakeRepoData.documentation.dependencies = {
                total: 3,
                pinned: 0,
                fractionPinned: 0,
            };
            const pinnedDependencies = metricClass.calculatePinnedDependencies(fakeRepoData);
            expect(pinnedDependencies).toEqual(0);
        });
    
        it('should handle invalid or null dependency fields gracefully', () => {
            fakeRepoData.documentation.dependencies = null as any;
            const pinnedDependencies = metricClass.calculatePinnedDependencies(fakeRepoData);
            expect(pinnedDependencies).toEqual(0); // Defaults to 0 for invalid data
        });
    
        it('should handle missing fractionPinned field gracefully', () => {
            fakeRepoData.documentation.dependencies = {
                total: 3,
                pinned: 2,
            } as any; // Missing fractionPinned
            const pinnedDependencies = metricClass.calculatePinnedDependencies(fakeRepoData);
            expect(pinnedDependencies).toEqual(0); // Defaults to 0 for incomplete data
        });
    });
    

    describe('Pull Request Metrics', () => {
        beforeEach(() => {
            // Reset fakeRepoData for each test
            fakeRepoData.pullRequestMetrics = {
                totalAdditions: 1000,
                reviewedAdditions: 800,
                reviewedFraction: 0.8
            };
        });
    
        it('should calculate PR score correctly with valid metrics', () => {
            const prScore = metricClass.calculatePullRequestScore(fakeRepoData);
            expect(prScore).toEqual(0.8);
        });
    
        it('should return 0 for undefined PR metrics', () => {
            fakeRepoData.pullRequestMetrics = {
                totalAdditions: -1,
                reviewedAdditions: -1,
                reviewedFraction: -1
            };
            const prScore = metricClass.calculatePullRequestScore(fakeRepoData);
            expect(prScore).toEqual(0);
        });
        it('should return 0 for zero total additions', () => {
            fakeRepoData.pullRequestMetrics = {
                totalAdditions: 0,
                reviewedAdditions: 0,
                reviewedFraction: 0
            };
            const prScore = metricClass.calculatePullRequestScore(fakeRepoData);
            expect(prScore).toEqual(0);
        });

        it('should return 0 for undefined PR metrics', () => {
            fakeRepoData.pullRequestMetrics = null as any; // Simulate missing PR metrics
            const prScore = metricClass.calculatePullRequestScore(fakeRepoData);
            expect(prScore).toEqual(0);
        });
    


        it('should handle for 100% reviewed prs', () => {
            fakeRepoData.pullRequestMetrics = {
                totalAdditions: 100,
                reviewedAdditions: 100,
                reviewedFraction: 1.0
            };
            const prScore = metricClass.calculatePullRequestScore(fakeRepoData);
            expect(prScore).toEqual(1.0);
        });
    
        it('should return 0 for no reviewed additions', () => {
            fakeRepoData.pullRequestMetrics = {
                totalAdditions: 500,
                reviewedAdditions: 0,
                reviewedFraction: 0
            };
            const prScore = metricClass.calculatePullRequestScore(fakeRepoData);
            expect(prScore).toEqual(0);
        });

        it('should correctly calculate PR score with large values', () => {
            fakeRepoData.pullRequestMetrics = {
                totalAdditions: 1_000_000,
                reviewedAdditions: 750_000,
                reviewedFraction: 0.75
            };
            const prScore = metricClass.calculatePullRequestScore(fakeRepoData);
            expect(prScore).toEqual(0.75);
        });
    
    
        it('should return correct latency value', () => {
            fakeRepoData.latency.pullRequests = 2000; // 2 seconds in milliseconds
            const latency = metricClass.getPullRequestLatency(fakeRepoData.latency);
            expect(latency).toEqual(2.0);
        });
        
        it('should handle zero latency value', () => {
            fakeRepoData.latency.pullRequests = 0; // 2 seconds in milliseconds
            const latency = metricClass.getPullRequestLatency(fakeRepoData.latency);
            expect(latency).toEqual(0);
        });

        it('should handle very high latency values correctly', () => {
            fakeRepoData.latency.pullRequests = 1_000_000; // 1000 seconds
            const latency = metricClass.getPullRequestLatency(fakeRepoData.latency);
            expect(latency).toEqual(1000.0);
        });

        it('should return 0 for negative latency values', () => {
            fakeRepoData.latency.pullRequests = -1000; // Simulate invalid negative latency
            const latency = metricClass.getPullRequestLatency(fakeRepoData.latency);
            expect(latency).toEqual(0);
        });


        it('should include PR score in net score calculation', () => {
            // Set up a scenario where we know the expected output
            fakeRepoData.licenses = ['MIT'];
            fakeRepoData.pullRequestMetrics = {
                totalAdditions: 1000,
                reviewedAdditions: 1000,
                reviewedFraction: 1.0
            };
            
            const netScore = metricClass.calculateNetScore(fakeRepoData);
            expect(netScore).toBeGreaterThan(0);
            expect(netScore).toBeLessThanOrEqual(1);
        });
    });

    // Test the overall getValue function
    it('Return correct values from getValue method', async () => {
        fakeRepoData.dependencies = [
            { name: 'dep1', version: '1.0.0' },
            { name: 'dep2', version: '2.3.x' },
        ];
    
        const result = await metricClass.getValue(fakeRepoData);
        expect(result).toHaveProperty('NetScore');
        expect(result).toHaveProperty('Correctness');
        expect(result).toHaveProperty('BusFactor');
        expect(result).toHaveProperty('RampUp');
        expect(result).toHaveProperty('ResponsiveMaintainer');
        expect(result).toHaveProperty('LicenseScore');
        expect(result).toHaveProperty('GoodPinningPractice');
    });
});
