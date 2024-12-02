import { repoData } from '../utils/interfaces';
import { metricData } from '../utils/interfaces';
import { repoLatencyData } from '../utils/types';

export class metricCalc{

    calculateCorrectness(data: repoData): number 
    {
        // Calculate correctness metric based on the data
        const { numberOfOpenIssues, numberOfClosedIssues } = data;

        //if number of issues is not found
        if(numberOfClosedIssues == -1 || numberOfOpenIssues == -1) {
            return 0;
        }

        if( numberOfClosedIssues == 0 || (numberOfOpenIssues / numberOfClosedIssues) >= 1) {
            return 0;
        }
        else if(numberOfOpenIssues/numberOfClosedIssues <= 0.5) {
            return 1;
        }
        else{
            return parseFloat((1 - (numberOfOpenIssues / numberOfClosedIssues)).toFixed(3));
        }
    }

    getCorrectnessLatency(latency: repoLatencyData): number 
    {
        return parseFloat(((latency.openIssues + latency.closedIssues) / 1000).toFixed(3));
    }

    calculateBusFactor(data: repoData): number 
    {
        const { numberOfContributors } = data;

        //if number of contributors is not found
        if(numberOfContributors == -1) {
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

    calculateRampup(data: repoData): number
    {
        // Calculate rampup metric based on the data
        const { numberOfLines, numberOfCommits, documentation } = data;

        //if variables used in calculation are not found
        if(numberOfLines == -1 || numberOfCommits == -1 || documentation.numLines == -1) {
            return 0;
        }

        let doc_total = 0;
        
        //Create the weightage for the Readme
        if(documentation.numLines > 300) doc_total += 0.1;
        if(documentation.hasExamples == true) doc_total += 0.1;
        if(documentation.hasDocumentation == true) doc_total += 0.14;
        if(documentation.hasReadme == false) doc_total *= 0;

        const rampup = (numberOfLines >= 500 ? 0.33 : 0) + (numberOfCommits >= 500  ? 0.33 : 0) + (doc_total);
        return parseFloat((rampup).toFixed(3));
    }

    getRampupLatency(latency: repoLatencyData): number 
    {
        return parseFloat(((latency.numberOfLines + latency.numberOfCommits + latency.documentation) / 1000).toFixed(3));
    }

    calculateResponsiveness(data: repoData): number 
    {
        // Calculate responsiveness metric based on the data

        //if last commit date is not found
        if(data.lastCommitDate == '') {
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

    checkLicenseExistence(data: repoData): number 
    {
        // Check if a specific license exists in the data
        const allowedLicenses = ['MIT', 'BSD-3-Clause', 'Apache-2.0', 'LGPL-2.1'];
        for(let i = 0; i < allowedLicenses.length; i++){
            if ((data.licenses).includes(allowedLicenses[i])){
                return 1;
            }
        }
        return 0;
    }

    calculateNetScore(data: repoData): number 
    {
        // Calculate the net score based on the individual metrics
        const weightedScore =   (0.3 * this.calculateResponsiveness(data)) +
                                (0.25 * this.calculateCorrectness(data)) + 
                                (0.2 * this.calculateRampup(data)) + 
                                (0.15 * this.calculateBusFactor(data))+ 
                                (0.1 * this.checkLicenseExistence(data)
                            );
        return this.checkLicenseExistence(data) * parseFloat(weightedScore.toFixed(3));
    }

    getNetScoreLatency(latency: repoLatencyData): number 
    {
        return parseFloat(((Math.max(latency.openIssues, latency.licenses) + latency.numberOfLines + latency.closedIssues + latency.numberOfCommits + latency.contributors) / 1000).toFixed(3));
        //return parseFloat((Math.max(latency.numberOfLines, latency.openIssues, latency.closedIssues, latency.licenses, latency.numberOfCommits, latency.numberOfLines, latency.documentation) / 1000).toFixed(3));
    }

    getValue(data: repoData): metricData {
        return {
            URL: data.repoUrl,
            NetScore: this.calculateNetScore(data),
            NetScore_Latency: this.getNetScoreLatency(data.latency),
            RampUp: this.calculateRampup(data),
            RampUp_Latency: this.getRampupLatency(data.latency),
            Correctness: this.calculateCorrectness(data),
            Correctness_Latency: this.getCorrectnessLatency(data.latency),
            BusFactor: this.calculateBusFactor(data),
            BusFactor_Latency: parseFloat((data.latency.contributors / 1000).toFixed(3)),
            ResponsiveMaintainer: this.calculateResponsiveness(data),
            ResponsiveMaintainer_Latency: parseFloat((data.latency.lastCommitDate / 1000).toFixed(3)),
            License: this.checkLicenseExistence(data),
            License_Latency: parseFloat((data.latency.licenses / 1000).toFixed(3))
        };
    }
}
