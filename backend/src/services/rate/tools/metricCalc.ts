import { repoData } from '../utils/interfaces';
import { metricData } from '../utils/interfaces';
import { repoLatencyData } from '../utils/types';
import { PackageRating } from '../../../common/interfaces';

export class metricCalc {

    calculateCorrectness(data: repoData): number {
        // Calculate correctness metric based on the data
        const { numberOfOpenIssues, numberOfClosedIssues } = data;

        //if number of issues is not found
        if (numberOfClosedIssues == -1 || numberOfOpenIssues == -1) {
            return 0;
        }

        if (numberOfClosedIssues == 0 || (numberOfOpenIssues / numberOfClosedIssues) >= 1) {
            return 0;
        }
        else if (numberOfOpenIssues / numberOfClosedIssues <= 0.5) {
            return 1;
        }
        else {
            return parseFloat((1 - (numberOfOpenIssues / numberOfClosedIssues)).toFixed(3));
        }
    }

    getCorrectnessLatency(latency: repoLatencyData): number {
        return parseFloat(((latency.openIssues + latency.closedIssues) / 1000).toFixed(3));
    }

    calculateBusFactor(data: repoData): number {
        const { numberOfContributors } = data;

        //if number of contributors is not found
        if (numberOfContributors == -1) {
            return 0;
        }

        let busFactor = 0;

        if (numberOfContributors < 15) busFactor = 0;
        else if (numberOfContributors < 50) busFactor = 0.25;
        else if (numberOfContributors < 100) busFactor = 0.5;
        else if (numberOfContributors < 200) busFactor = 0.75;
        else busFactor = 1;

        return busFactor;
    }

    calculateRampup(data: repoData): number {
        // Calculate rampup metric based on the data
        const { numberOfLines, numberOfCommits, documentation } = data;

        //if variables used in calculation are not found
        if (numberOfLines == -1 || numberOfCommits == -1 || documentation.numLines == -1) {
            return 0;
        }

        let doc_total = 0;

        //Create the weightage for the Readme
        if (documentation.numLines > 300) doc_total += 0.1;
        if (documentation.hasExamples == true) doc_total += 0.1;
        if (documentation.hasDocumentation == true) doc_total += 0.14;
        if (documentation.hasReadme == false) doc_total *= 0;

        const rampup = (numberOfLines >= 500 ? 0.33 : 0) + (numberOfCommits >= 500 ? 0.33 : 0) + (doc_total);
        return parseFloat((rampup).toFixed(3));
    }

    getRampupLatency(latency: repoLatencyData): number {
        return parseFloat(((latency.numberOfLines + latency.numberOfCommits + latency.documentation) / 1000).toFixed(3));
    }

    calculateResponsiveness(data: repoData): number {
        // Calculate responsiveness metric based on the data

        //if last commit date is not found
        if (data.lastCommitDate == '') {
            return 0;
        }

        const currentDate = new Date();
        const commitDate = new Date(data.lastCommitDate);

        const yearDifference = currentDate.getFullYear() - commitDate.getFullYear();
        const monthDifference = currentDate.getMonth() - commitDate.getMonth();

        // Total month difference as an integer
        const totalMonthsDifference = yearDifference * 12 + monthDifference;

        // Ensure the difference is not negative (for future dates)
        const monthsDifference = Math.max(totalMonthsDifference, 0);
        const score = Math.max(0, 1 - (monthsDifference / 12));

        return parseFloat(score.toFixed(3));
    }

    checkLicenseExistence(data: repoData): number {
        // Check if a specific license exists in the data
        const allowedLicenses = ['MIT', 'BSD-3-Clause', 'Apache-2.0', 'LGPL-2.1'];
        for (let i = 0; i < allowedLicenses.length; i++) {
            if ((data.licenses).includes(allowedLicenses[i])) {
                return 1;
            }
        }
        return 0;
    }

    calculatePinnedDependencies(data: repoData): number {
        //if invalid (undefined) dependencies are found
        if (data.dependencies == undefined) {
            return 0;
        }
        if (!data.dependencies || data.dependencies.length === 0) {
            return 1.0; // Perfect score if no dependencies
        }



        const pinnedCount = data.dependencies.filter(dep => /^\d+\.\d+/.test(dep.version)).length;
        const fractionPinned = pinnedCount / data.dependencies.length;

        return parseFloat(fractionPinned.toFixed(3));
    }

    getPinnedDependenciesLatency(latency: repoLatencyData): number {
        if (latency.dependencies == undefined) {
            return -1;
        }
        return parseFloat((latency.dependencies / 1000).toFixed(3));
    }

    calculatePullRequestScore(data: repoData): number {
        if (!data.pullRequestMetrics) {
            return 0;
        }

        return data.pullRequestMetrics.reviewedFraction;
    }

    getPullRequestLatency(latency: repoLatencyData): number {
        return parseFloat((latency.pullRequests / 1000).toFixed(3));
    }



    calculateNetScore(data: repoData): number {
        // Calculate the net score based on the individual metrics
        const weightedScore = (0.25 * this.calculateResponsiveness(data)) +
            (0.2 * this.calculateCorrectness(data)) +
            (0.15 * this.calculateRampup(data)) +
            (0.15 * this.calculateBusFactor(data)) +
            (0.1 * this.calculatePinnedDependencies(data)) +
            (0.15 * this.calculatePullRequestScore(data));
        return this.checkLicenseExistence(data) * parseFloat(weightedScore.toFixed(3));
    }

    getNetScoreLatency(latency: repoLatencyData): number {
        return parseFloat(((Math.max(latency.openIssues, latency.licenses) + latency.numberOfLines + latency.closedIssues + latency.numberOfCommits + latency.contributors + latency.pullRequests + (latency.dependencies || 0)) / 1000).toFixed(3));
        //return parseFloat((Math.max(latency.numberOfLines, latency.openIssues, latency.closedIssues, latency.licenses, latency.numberOfCommits, latency.numberOfLines, latency.documentation) / 1000).toFixed(3));
    }

    async getValue(data: repoData): Promise<PackageRating> {
        // Run the functions concurrently and measure the latencies
        const functions = [
            this.calculateRampup,
            this.calculateCorrectness,
            this.calculateBusFactor,
            this.calculateResponsiveness,
            this.checkLicenseExistence,
            this.calculatePinnedDependencies,
            this.calculatePullRequestScore,
        ]
        const { latencies, results, errors } = await measureConcurrentLatencies(functions, data);
        // calculate the netscore as the sum of the individual scores
        const netScore = results.reduce((accumulator, currentValue) => (accumulator || 0) + (currentValue || 0), 0);
        const netScoreLatency = latencies.reduce((accumulator, currentValue) => accumulator + currentValue, 0);
        
        return {
            NetScore: netScore || 0,
            NetScoreLatency: netScoreLatency || 0,
            RampUp: results[0] || 0,
            RampUpLatency: latencies[0] || 0,
            Correctness: results[1] || 0,
            CorrectnessLatency: latencies[1] || 0,
            BusFactor: results[2] || 0,
            BusFactorLatency: latencies[2] || 0,
            ResponsiveMaintainer: results[3] || 0,
            ResponsiveMaintainerLatency: latencies[3] || 0,
            LicenseScore: results[4] || 0,
            LicenseScoreLatency: latencies[4] || 0,
            GoodPinningPractice: results[5] || 0,
            GoodPinningPracticeLatency: latencies[5] || 0,
            PullRequest: results[6] || 0,
            PullRequestLatency: latencies[6] || 0,
        };
    }
}

/**
 * Measures the latencies of concurrent asynchronous functions.
 *
 * @param fns - An array of functions that each take an `owner` and `repo` string and return a Promise resolving to a number.
 * @param owner - The owner of the repository.
 * @param repo - The repository name.
 * @returns A Promise that resolves to an object containing:
 * - `latencies`: An array of latencies (in seconds) for each function.
 * - `results`: An array of results from each function, or `null` if an error occurred.
 * - `errors`: An array of errors from each function, or `null` if no error occurred.
 */
export async function measureConcurrentLatencies(
    fns: ((data: repoData) => number)[],
    data: repoData,
): Promise<{ latencies: number[], results: (number | null)[], errors: (any | null)[] }> {
    const latencies: number[] = new Array(fns.length);
    const results: (number | null)[] = new Array(fns.length);
    const errors: (any | null)[] = new Array(fns.length);

    // Create an array of promises to track each function call's latency
    const promises = fns.map((fn, index) => (async () => {
        const start = performance.now();
        try {
            const result = fn(data);
            const end = performance.now();
            const seconds_elapsed = Number(((end - start) / 1000).toFixed(3));
            latencies[index] = seconds_elapsed;   // Assign to the correct index
            results[index] = result;          // Assign to the correct index
            errors[index] = null;             // No error
        } catch (error) {
            const end = performance.now();
            const seconds_elapsed = Number(((end - start) / 1000).toFixed(3));
            latencies[index] = seconds_elapsed;   // Assign to the correct index
            results[index] = null;            // No result in case of error
            errors[index] = error;            // Capture error
        }
    })());

    // Wait for all promises to settle
    await Promise.all(promises);

    return { latencies, results, errors };
}