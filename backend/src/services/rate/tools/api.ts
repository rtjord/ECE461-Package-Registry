import * as fs from 'fs/promises';
import * as git from 'isomorphic-git';
import * as http from 'isomorphic-git/http/node';
import axios, { AxiosInstance } from 'axios';
import { gitData, npmData } from '../utils/interfaces';
import { logger } from './logging';
import { envVars } from '../utils/interfaces';

export class npmAnalysis {
    private logger: logger;

    constructor(envVars: envVars) {
        this.logger = new logger(envVars);
    }

    async cloneRepo(url: string, dir: string, version: string): Promise<void> {
        try {
            try {
                await fs.access(dir);
                this.logger.logInfo(`Repository already exists in directory: ${dir}`);
                return;
            } catch {
                this.logger.logDebug(`Directory does not exist, proceeding to clone...`);
            }

            this.logger.logInfo(`Cloning repository...`);
            await git.clone({
                fs,
                http,
                dir,
                url,
                singleBranch: true,
                depth: 1,
                ...(version && { ref: version }) // Specify the version or branch to clone
            });
            this.logger.logInfo(`Repository ${url} cloned in directory ${dir}.`);
        } catch {
            this.logger.logDebug(`Error cloning repository for ${url} in ${dir}.`);
        }
    }

    async getReadmeContent(dir: string, npmData: npmData): Promise<void> {
        try {
            const oid = await git.resolveRef({ fs, dir, ref: 'HEAD' });
            const { tree } = await git.readTree({ fs, dir, oid });
            console.log('tree', tree);
    
            const readmeEntry = tree.find(entry => 
                ['readme.md', 'readme', 'readme.txt', 'readme.rst'].includes(entry.path.toLowerCase())
            );
            console.log('readmeEntry', readmeEntry);
    
            let readmeContent: string | null = null;
            if (readmeEntry) {
                // Found a README file in the repository
                const readmeBlob = await git.readBlob({ fs, dir, oid: readmeEntry.oid });
                readmeContent = new TextDecoder().decode(readmeBlob.blob);
            } else {
                // No README file found, try to fetch README from the package URL (if applicable)
                this.logger.logInfo(`No README file found in the repository tree. Trying to fetch via package URL...`);
                const readmeUrl = `${npmData.repoUrl}#readme`; // Construct URL to fetch README
                const response = await fetch(readmeUrl);
    
                if (response.ok) {
                    readmeContent = await response.text();
                } else {
                    this.logger.logDebug(`Could not retrieve README from package URL ${readmeUrl} in ${dir}`);
                }
            }
    
            if (readmeContent) {
                npmData.documentation.hasReadme = true;
                npmData.documentation.numLines = readmeContent.split('\n').length;
                npmData.documentation.hasExamples = /[Ee]xample/i.test(readmeContent);
                npmData.documentation.hasDocumentation = /[Dd]ocumentation/i.test(readmeContent) || /[Dd]ocs/i.test(readmeContent);
            }
        } catch {
            this.logger.logDebug(`Error retrieving the README content for ${npmData.repoUrl} in ${dir}`);
        }
    } 

    async lastCommitDate(dir: string, npmData: npmData): Promise<void> {
        this.logger.logDebug(`Finding time since last commit...`);
        try {
            const commits = await git.log({ fs, dir, depth: 1 });
            console.log('commits:', commits);
            const lastCommit = commits[0]; 
        
            if (lastCommit) {
              const lastCommitDate = new Date(lastCommit.commit.author.timestamp * 1000);
              npmData.lastCommitDate = lastCommitDate.toDateString();
            } else {
                this.logger.logDebug(`No commits found in the repository ${npmData.repoUrl} in dir ${dir}`);
            }
        } catch {
            this.logger.logDebug(`Error retrieving the last commit in ${dir} for ${npmData.repoUrl} from lastCommitDate`);
        }
    }

    async analyzeDependencies(dir: string, npmData: npmData): Promise<void> { 
        try {
            const packageJsonPath = `${dir}/package.json`;
            const packageJson = await fs.readFile(packageJsonPath, 'utf-8');
            const packageData = JSON.parse(packageJson);

            const dependencies = {... packageData.dependencies, ... packageData.devDependencies};
            const pinnedCount =  Object.values(dependencies).filter(version => /^\d+\.\d+/.test(version as string)).length;
            
            const totalDependencies = Object.keys(dependencies).length;
            const fractionPinned = totalDependencies > 0 ? pinnedCount / totalDependencies : 1.0;

            npmData.documentation.dependencies = {
                total: totalDependencies,
                pinned: pinnedCount,
                fractionPinned: parseFloat(fractionPinned.toFixed(3))
            };
        }
        catch (error) {
            this.logger.logDebug(`Error analyzing dependencies in ${dir} for ${npmData.repoUrl}: ${error}`);
            npmData.documentation.dependencies = {
                total: 0,
                pinned: 0,
                fractionPinned: 1.0
            };
        }
    }
    async deleteRepo(dir: string): Promise<void> {
        this.logger.logDebug(`Deleting repository ${dir}...`);
        try {
            await fs.rm(dir, { recursive: true, force: true });
            this.logger.logDebug(`Repository in ${dir} deleted`);
        } catch {
            this.logger.logDebug(`Failed to delete repository in ${dir}:`);
        }
    }

    private async executeTasks(task: (repoDir: string, npmData: npmData) => Promise<void>, repoDir: string, npmData: npmData): Promise<number> {
        const startTime = performance.now();
        await task(repoDir, npmData);
        const endTime = performance.now();
        return endTime - startTime;
    }
    
    
    // Main function to run the tasks in order
    async runTasks(url: string, dest: number, version: string): Promise<npmData> {
        const repoDir = './dist/repoDir'+dest.toString();
        console.log('Running npm tasks in', repoDir);
        this.logger.logDebug(`Running npm tasks in ${repoDir}...`);
        const npmData: npmData = {
            repoUrl: url,
            lastCommitDate: '',
            documentation: {
                hasReadme: false,
                numLines: -1,
                hasExamples: false,
                hasDocumentation: false,
                dependencies: undefined,
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
                pullRequests: -1

            }
        };

        await this.cloneRepo(url, repoDir, version);
        [ npmData.latency.lastCommitDate,
          npmData.latency.documentation
        ] = await Promise.all([
            this.executeTasks(this.lastCommitDate.bind(this), repoDir, npmData),
            this.executeTasks(this.getReadmeContent.bind(this), repoDir, npmData)
        ]);

        npmData.latency.dependencies = await this.executeTasks(this.analyzeDependencies.bind(this), repoDir, npmData);
        await this.deleteRepo(repoDir);
    
        this.logger.logInfo(`All npm tasks completed in order within dir ${repoDir}`);
        return npmData;
    }
}

export class gitAnalysis {
    private axiosInstance: AxiosInstance;
    private logger: logger;
    private token: string;
    
    //axios instance using tokens, loglevel, logfile from .env
    constructor(envVars: envVars) {
        this.logger = new logger(envVars);
        this.token = envVars.token;
        this.axiosInstance = axios.create({
            baseURL: 'https://api.github.com',
            timeout: 5000,
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/vnd.github.v3+json',
                'Authorization': `Bearer ${this.token}`
            }
        });
    }

    async isTokenValid(): Promise<boolean> {
        let isValid = false;
        try {
            const response = await this.axiosInstance.get('/repos/Tridentinus/dummyPackage');
            isValid = response.status === 200;
        } catch {
            isValid = false;
        }
        this.logger.logInfo(`Token is valid: ${isValid}`);
        return isValid;
    }

    async checkConnection(url: string): Promise<boolean> {
        try {
            // Make a simple request to GitHub to check the rate limit endpoint
            await this.axiosInstance.get(url);
            this.logger.logInfo('Connection successful: status 200');
            return true;
        } catch (error) {
            this.logger.logDebug('Connection failed: ', error);
            return false;
        }
    }

    async getOwnerAndRepo(gitData: gitData): Promise<void> {
        this.logger.logDebug('Fetching owner and repo name...');
        if (!gitData.repoUrl) {
            this.logger.logInfo(`Invalid URL: ${gitData.repoUrl}`);
            return;
        }

        const urlParts = gitData.repoUrl.split('/');
        if (urlParts.length >= 5) {
            gitData.repoOwner = urlParts[3];
            gitData.repoName = urlParts[4];
        } else {
            this.logger.logDebug(`Invalid GitHub repository URL format: ${gitData.repoUrl}`);
        }
    }

    async fetchOpenIssues(gitData: gitData): Promise<void> {
        this.logger.logDebug(`Fetching open issues for ${gitData.repoName}...`);
        try {
            const issues = await this.axiosInstance.get(`/repos/${gitData.repoOwner}/${gitData.repoName}`);
            gitData.numberOfOpenIssues = issues.data.open_issues_count;
            this.logger.logDebug(`Open Issues fetched successfully for ${gitData.repoName}`);
        } catch (error) {
            this.logger.logDebug(`Error fetching open issues for ${gitData.repoName}`, error);
        }
    }

    async exponentialBackoff<T>(
        requestFn: () => Promise<T>,          // The function making the API request
        maxRetries: number = 10,               // Maximum number of retries
        initialDelay: number = 1000           // Initial delay in milliseconds
    ): Promise<T> {
        let retryCount = 0;
        let delay = initialDelay;
    
        while (retryCount <= maxRetries) {
            try {
                // Try the request function
                return await requestFn();
            } catch (error) {
                retryCount++;
                if (retryCount > maxRetries) {
                    this.logger.logDebug(`Max retries exceeded`);
                }

                this.logger.logDebug(`Retry ${retryCount}/${maxRetries} after error: ${error}`);
                // Wait for the delay before retrying
                await new Promise(resolve => setTimeout(resolve, delay));
                delay *= 2;  // Exponential backoff: double the delay
            }
        }
    
        throw new Error(`Failed to complete the request after ${maxRetries} retries`);
    }
    
    //retrieve data for closed issues
    async fetchClosedIssues(gitData: gitData): Promise<void> {
        this.logger.logDebug(`Fetching closed issues for ${gitData.repoName}...`);

        try {
            let page = 1;
            let totalClosedIssues = 0;
            let issues;

            do {
                const endpoint = `/repos/${gitData.repoOwner}/${gitData.repoName}/issues`;
                const params = {
                    state: 'closed',
                    per_page: 100,  // Max per page
                    page: page
                };

                // Use the exponentialBackoff function to handle retries
                const response = await this.exponentialBackoff(() =>
                    this.axiosInstance.get(endpoint, { params })
                );

                issues = response.data;
                totalClosedIssues += issues.length;
                page++;

            } while ((gitData.numberOfOpenIssues * 2) >= totalClosedIssues && issues.length > 0); // Continue until open issues is 1/2 of closed issues or no more closed issues

            this.logger.logDebug(`Closed Issues Count fetched successfully for ${gitData.repoName}`);
            gitData.numberOfClosedIssues = totalClosedIssues;

        } catch (error) {
            this.logger.logDebug(`Error fetching closed issues for ${gitData.repoName}`, error);
        }
    }

    //retrieve data for number of contributors
    async fetchContributors(gitData: gitData): Promise<void> {
        this.logger.logDebug(`Fetching contributors for ${gitData.repoName}...`);
    
        try {
            let page = 1;
            let contributorsCount = 0;
            let hasMorePages = true;
    
            // Fetch contributors with pagination and exponential backoff
            while (hasMorePages) {
                const endpoint = `/repos/${gitData.repoOwner}/${gitData.repoName}/contributors`;
                const params = {
                    per_page: 100,  // Fetch up to 100 contributors per page
                    page: page
                };
    
                // Use exponential backoff to handle retries on failure
                const response = await this.exponentialBackoff(() =>
                    this.axiosInstance.get(endpoint, { params })
                );
    
                // Update count and check for more pages
                contributorsCount += response.data.length;
                const linkHeader = response.headers['link'];
                hasMorePages = typeof linkHeader === 'string' && linkHeader.includes('rel="next"');
                page++;
            }
    
            this.logger.logDebug(`Contributors Count fetched successfully for ${gitData.repoName}`);
            gitData.numberOfContributors = contributorsCount;
    
        } catch (error) {
            this.logger.logDebug(`Error fetching number of contributors for ${gitData.repoName}`, error);
        }
    }
    
    async fetchLicense(gitData: gitData): Promise<void> {
        this.logger.logDebug(`Fetching license for ${gitData.repoName}...`);
        try {
            this.logger.logDebug(`Fetching package.json wihtin ${gitData.repoName} to find the license...`);
            const packageJsonResponse = await this.axiosInstance.get(`/repos/${gitData.repoOwner}/${gitData.repoName}/contents/package.json`);
            const packageJsonContentEncoded = packageJsonResponse.data.content;
            const packageJsonContent = Buffer.from(packageJsonContentEncoded, 'base64').toString('utf-8');
            const packageJson = JSON.parse(packageJsonContent);
            console.log('packageJson:', packageJson);
            if (packageJson.license) {
                gitData.licenses = packageJson.license;
                this.logger.logDebug(`License found in package.json for ${gitData.repoName}`);
            }
        } catch (packageJsonError) {
            this.logger.logDebug(`Error fetching package.json for ${gitData.repoUrl}: ${packageJsonError} from fetchLicense`);
        }
    }

    //retrieve data for number of commits
    async fetchCommits(gitData: gitData): Promise<void> {
        this.logger.logDebug(`Fetching commits for ${gitData.repoName}...`);
        try {
            // Initialize count
            let totalCommits = 0;
            let page = 1;
            let hasMoreCommits = true;

            while (hasMoreCommits && totalCommits < 500) {
                const response = await this.axiosInstance.get(`/repos/${gitData.repoOwner}/${gitData.repoName}/commits`, {
                    params: {
                        per_page: 100, // Max number of commits per page
                        page: page
                    }
                });

                // Increment total commits by the number of commits received
                totalCommits += response.data.length;
                hasMoreCommits = response.data.length === 100;
                page++;
            }

            gitData.numberOfCommits = totalCommits;
            this.logger.logDebug(`Commits Count fetched successfully for ${gitData.repoName}`);
        } catch (error) {
            this.logger.logDebug(`Error fetching number of commits for ${gitData.repoName}`, error);
        }
    }

    //retrieve total number of lines 
    async fetchLines(gitData: gitData): Promise<void> {
        this.logger.logDebug(`Fetching lines of code for ${gitData.repoName}...`);

        // Helper for determining if it's a file or directory
        const processDirorFile = async (file: { type: string; download_url?: string; url?: string }): Promise<number> => {
            let result = 0;
            if (file.type === 'file') {
                try {
                    if (file.download_url) {
                        const fileResponse = await this.axiosInstance.get(file.download_url);
                        if (typeof fileResponse.data === 'string') {
                            result += fileResponse.data.split('\n').length;
                        }
                    }
                    return result;
                } catch (error) {
                    this.logger.logDebug(`Error fetching file content for ${gitData.repoName}: `, error);
                    return result;
                }
            } else if (file.type === "dir" && file.url) {
                try {
                    const directoryResponse = await this.axiosInstance.get(file.url); // Fetch directory contents
                    const directoryFiles = directoryResponse.data;

                    const filePromises = directoryFiles.map(processDirorFile);
                    const fileLines = await Promise.all(filePromises);

                    result += fileLines.reduce((sum, value) => sum + value, 0);
                    return result;
                } catch (error) {
                    this.logger.logDebug(`Error fetching directory contents for ${gitData.repoName}:`, error);
                    return result;
                }
            }
            return result; // If not a file or directory
        };

        try {
            let totalLines = 0;
            // Fetch the list of files in the root directory
            const response = await this.exponentialBackoff(() =>
                this.axiosInstance.get(`/repos/${gitData.repoOwner}/${gitData.repoName}/contents`, {
                    params: { per_page: 100 } // Adjust as needed
                })
            );

            const files = response.data;

            // Process each file or directory
            for (const file of files) {
                if (totalLines >= 500) break;
                const fileLines = await processDirorFile(file);
                totalLines += fileLines;
                if (totalLines >= 500) break; // Double check to stop if total exceeds 500 after processing
            }

            gitData.numberOfLines = totalLines;
            this.logger.logDebug(`Lines of code fetched successfully for ${gitData.repoName}`);
        } catch (error) {
            this.logger.logDebug(`Error fetching number of lines for ${gitData.repoName}`, error);
        }
    }
        // Add to api.ts in gitAnalysis class

    async fetchPullRequests(gitData: gitData): Promise<void> {
        this.logger.logDebug(`Fetching pull requests for ${gitData.repoName}...`);
        try {
            // Validate owner and repo name first
            if (!gitData.repoOwner || !gitData.repoName) {
                throw new Error('Invalid repository owner or name');
            }

            let page = 1;
            let totalReviewedAdditions = 0;
            let totalAdditions = 0;
            let hasMorePRs = true;

            while (hasMorePRs) {
                try {
                    // Fetch PRs with pagination
                    const response = await this.exponentialBackoff(() =>
                        this.axiosInstance.get(`/repos/${gitData.repoOwner}/${gitData.repoName}/pulls`, {
                            params: {
                                state: 'closed',
                                per_page: 100,
                                page: page
                            }
                        })
                    );

                    const prs = response.data;
                    hasMorePRs = prs.length === 100;

                    // Process each PR
                    for (const pr of prs) {
                        try {
                            // Get PR details including additions
                            const prDetailResponse = await this.exponentialBackoff(() =>
                                this.axiosInstance.get(`/repos/${gitData.repoOwner}/${gitData.repoName}/pulls/${pr.number}`)
                            );

                            const additions = prDetailResponse.data.additions;
                            totalAdditions += additions;

                            // Get reviews for this PR
                            const reviewsResponse = await this.exponentialBackoff(() =>
                                this.axiosInstance.get(`/repos/${gitData.repoOwner}/${gitData.repoName}/pulls/${pr.number}/reviews`)
                            );

                            // If PR has reviews, count its additions
                            if (reviewsResponse.data.length > 0) {
                                totalReviewedAdditions += additions;
                            }
                        } catch (prError) {
                            this.logger.logDebug(`Error processing PR ${pr.number}: ${prError}`);
                            continue; // Skip this PR and continue with others
                        }
                    }

                    page++;
                } catch (pageError) {
                    this.logger.logDebug(`Error fetching page ${page}: ${pageError}`);
                    break; // Stop processing if we can't fetch a page
                }
            }

            // Set the metrics with calculated values
            gitData.pullRequestMetrics = {
                totalAdditions,
                reviewedAdditions: totalReviewedAdditions,
                reviewedFraction: totalAdditions > 0 ? parseFloat((totalReviewedAdditions / totalAdditions).toFixed(3)) : 0
            };

            this.logger.logDebug(`Pull request metrics calculated successfully for ${gitData.repoName}`);
        } catch (error) {
            this.logger.logDebug(`Error fetching pull requests for ${gitData.repoName}: ${error}`);
            // Set default values in case of error
            gitData.pullRequestMetrics = {
                totalAdditions: 0,
                reviewedAdditions: 0,
                reviewedFraction: 0
            };
        }
    }
    private async executeTasks(task: (gitData: gitData) => Promise<void>, gitData: gitData): Promise<number> {
        const startTime = performance.now();
        await task(gitData);
        const endTime = performance.now();
        return endTime - startTime;
    }

    async runTasks(url: string): Promise<gitData> { 
        const gitData: gitData = {
            repoName: '',
            repoUrl: url,
            repoOwner: '',
            numberOfContributors: -1,
            numberOfOpenIssues: -1,
            numberOfClosedIssues: -1,
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
                pullRequests: -1
            }
        };

        this.logger.logDebug(`Running git tasks for ${gitData.repoUrl}...`);
        if (await this.checkConnection(url)) {
            await this.getOwnerAndRepo(gitData);
            [ gitData.latency.openIssues,
              gitData.latency.licenses,
            ] = await Promise.all([
                this.executeTasks(this.fetchOpenIssues.bind(this), gitData),
                this.executeTasks(this.fetchLicense.bind(this), gitData),
            ]);
            gitData.latency.closedIssues = await this.executeTasks(this.fetchClosedIssues.bind(this), gitData);
            gitData.latency.numberOfLines = await this.executeTasks(this.fetchLines.bind(this), gitData)
            gitData.latency.numberOfCommits = await this.executeTasks(this.fetchCommits.bind(this), gitData);
            gitData.latency.contributors = await this.executeTasks(this.fetchContributors.bind(this), gitData);

            this.logger.logInfo(`All git tasks completed in order for ${gitData.repoUrl}`);
            return gitData;
        }
        this.logger.logDebug(`No git tasks completed. Invalid URL: ${url}`);
        return gitData;
    }
}
