import * as fs from 'fs';
import * as https from 'https';
import * as readline from 'readline';
import { logger } from './logging';
import { envVars } from '../utils/interfaces';

export class urlAnalysis {
    private logger: logger;

    constructor(envVars: envVars) {
        this.logger = new logger(envVars);
    }

    async evalUrl(url: string): Promise<[number, string]> {
        const npmPattern = /^https:\/\/www\.npmjs\.com\/package\/[\w-]+$/;
        const gitPattern = /^https:\/\/github\.com\/[\w-]+\/[\w-]+$/;
    
        if (gitPattern.test(url)) {
            const cleanedUrl = url.replace(/\.git$/, '');
            return [0, cleanedUrl];
        } else if (npmPattern.test(url)) {
            try {
                const repoUrl = await this.getRepositoryUrl(url);
                return [0, repoUrl || ''];  // Ensure we return an empty string if repoUrl is null
            } catch (error) {
                this.logger.logDebug('Error fetching repository URL:', error);
                return [-1, ''];  // Return error code and empty string on failure
            }
        } else {
            return [-1, ''];
        }
    }

    extractPackageName(url: string): string | null {
        const npmPattern = /^https:\/\/www\.npmjs\.com\/package\/[\w-]+$/;
        if (npmPattern.test(url)) {
          const parts = url.split('/');
          return parts[parts.length - 1];  // Get the last part of the URL
        } else {
          this.logger.logDebug('Invalid npm package URL');
          return null;
        }
    }

    async getRepositoryUrl(url: string): Promise<string | null> {
        const packageName = this.extractPackageName(url);
        if (!packageName) {
            return null;  // Return null if package name extraction fails
        }

        const registryUrl = 'https://registry.npmjs.org/'+packageName;
        return new Promise((resolve, reject) => {
            https.get(registryUrl, (res) => {
                let data = '';
                res.on('data', (chunk) => {
                    data += chunk;
                });
                res.on('end', () => {
                    try {
                        const packageData = JSON.parse(data);
                        // Check if repository field exists and return the URL
                        if (packageData.repository && packageData.repository.url) {
                            let repoUrl = packageData.repository.url;
                            // Remove 'git+' and '.git' scheme if present
                            repoUrl = repoUrl.replace(/^git\+/, '');
                            repoUrl = repoUrl.replace(/\.git$/, '');
                            // Convert SSH URLs to HTTPS
                            repoUrl = repoUrl.replace(/^ssh:\/\/git@github\.com/, 'https://github.com');
                            resolve(repoUrl);
                        } else {
                            resolve(null);  // No repository URL found
                        }
                    } catch (err) {
                        reject('Error parsing npm registry data: ' + err);
                    }
                });
            }).on('error', (err) => {
                reject('Error fetching data from npm registry: ' + err);
            });
        });
    }
}

export async function parseURLsToArray(filePath: string): Promise<string[]> {
    const fileStream = fs.createReadStream(filePath);
    const rl = readline.createInterface({
        input: fileStream,
        crlfDelay: Infinity,
    });

    const urlArray: string[] = []; // Array to store URLs

    // Process each line (URL) in the file
    for await (const line of rl) {
        urlArray.push(line); // Add the URL to the array
    }

    return urlArray;
}
