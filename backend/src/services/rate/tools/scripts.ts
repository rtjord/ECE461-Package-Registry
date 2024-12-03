import { urlAnalysis } from './urlOps';
import { repoData } from '../utils/interfaces';
import { gitAnalysis, npmAnalysis } from './api';
import { envVars } from '../utils/interfaces';
import { logger } from './logging';

export class runAnalysis {
    private npmAnalysis: npmAnalysis;
    private gitAnalysis: gitAnalysis;
    private urlAnalysis: urlAnalysis;
    private token: string;
    private logger: logger;

    constructor(envVars: envVars) {
        this.token = envVars.token;
        this.logger = new logger(envVars);
        this.npmAnalysis = new npmAnalysis(envVars);
        this.gitAnalysis = new gitAnalysis(envVars);
        this.urlAnalysis = new urlAnalysis(envVars);
    }
/*
    async runAnalysis(urls: string[]): Promise<repoData[]> {
        const isTokenValid = await this.gitAnalysis.isTokenValid();
        if (isTokenValid === false) {
            process.stdout.write('No valid token provided\n');
            process.exit(1);
        }
        const start = performance.now();
        const repoDataPromises = urls.map((url, index) => this.evaluateMods(url, index));
        const repoDataArr = await Promise.all(repoDataPromises);
        const end = performance.now();
        this.logger.logInfo(`Total time taken: ${parseFloat(((end - start) / 1000).toFixed(3))} s`);
        return repoDataArr;
    }
    
    async runAnalysis(urls: string[]): Promise<repoData[]> {
        const isTokenValid = await this.gitAnalysis.isTokenValid();
        if (!isTokenValid) {
            process.stdout.write('No valid token provided\n');
            process.exit(1);
        }

        const start = performance.now();
        const Promise = require('bluebird');
        const repoDataArr: repoData[] = await Promise.map(urls, 
                            async (url: string, index: number) => 
                            this.evaluateMods(url, index), 
                            { concurrency: 2 });
        //const repoDataArr = await Promise.all(repoDataPromises);
        const end = performance.now();
        this.logger.logInfo(`Total time taken: ${parseFloat(((end - start) / 1000).toFixed(3))} s`);
        return repoDataArr;
    }  
*/

    async runAnalysis(urls: string[]): Promise<repoData[]> {
        const isTokenValid = await this.gitAnalysis.isTokenValid();
        if (!isTokenValid) {
            process.stdout.write('No valid token provided\n');
            process.exit(1);
        }

        const start = performance.now();
        const repoDataArr: repoData[] = [];
        for (const [index, url] of urls.entries()) {
            const repoData = await this.evaluateMods(url, index);
            repoDataArr.push(repoData); // Collect the results one by one
        }
        const end = performance.now();
        this.logger.logInfo(`Total time taken: ${parseFloat(((end - start) / 1000).toFixed(3))} s`);
        return repoDataArr;
    } 

    async evaluateMods(url: string, index: number): Promise<repoData> {
        const [type, cleanedUrl] = await this.urlAnalysis.evalUrl(url);
        let repoData: repoData = {
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
                documentation: -1
            }
        };

        if (type === -1 || cleanedUrl === '') {
            this.logger.logDebug(`Invalid URL - ${url}`);
            return repoData;
        }

        const [npmData, gitData] = await Promise.all([
            this.npmAnalysis.runTasks(cleanedUrl, index),
            this.gitAnalysis.runTasks(cleanedUrl)
        ]);


        repoData = {
            repoName: gitData.repoName,
            repoUrl: url,
            repoOwner: gitData.repoOwner,
            numberOfContributors: gitData.numberOfContributors,
            numberOfOpenIssues: gitData.numberOfOpenIssues,
            numberOfClosedIssues: gitData.numberOfClosedIssues,
            lastCommitDate: npmData.lastCommitDate,
            licenses: gitData.licenses,
            numberOfCommits: gitData.numberOfCommits,
            numberOfLines: gitData.numberOfLines,
            documentation: {
                hasReadme: npmData.documentation.hasReadme,
                numLines: npmData.documentation.numLines,
                hasExamples: npmData.documentation.hasExamples,
                hasDocumentation: npmData.documentation.hasDocumentation,
                dependencies: npmData.documentation.dependencies
            },
            latency: {
                contributors: gitData.latency.contributors,
                openIssues: gitData.latency.openIssues,
                closedIssues: gitData.latency.closedIssues,
                lastCommitDate: npmData.latency.lastCommitDate,
                licenses: gitData.latency.licenses,
                numberOfCommits: gitData.latency.numberOfCommits,
                numberOfLines: gitData.latency.numberOfLines,
                documentation: npmData.latency.documentation
            }
        };

        return repoData;
    }
}
