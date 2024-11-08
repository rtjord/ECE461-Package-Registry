import { Command } from 'commander';
import { exec } from 'child_process';
import { getEnvVars } from './tools/getEnvVars';
import { envVars } from './utils/interfaces';
import { runAnalysis } from './tools/scripts';
import { gitAnalysis } from './tools/api'
import { parseURLsToArray } from './tools/urlOps';
import { repoData } from './utils/interfaces';
import { metricCalc } from './tools/metricCalc';
import dotenv from 'dotenv';

dotenv.config();
const program = new Command();

program
    .version('1.0.0')
    .description('ECE461 Package Registry Analysis Phase 1')

program
    .argument('<URL_FILE>', 'File containing URLs to analyze')
    .action(async (urlFile: string) => {
        const envVar: envVars = new getEnvVars();
        const urlList: string[] = await parseURLsToArray(urlFile);
        const runAnalysisClass = new runAnalysis(envVar);
        try {
            const repoData: repoData[] = await runAnalysisClass.runAnalysis(urlList);
            
            for (const repo of repoData) {
                const metricCalcClass = new metricCalc();
                const result = metricCalcClass.getValue(repo);
                process.stdout.write(JSON.stringify(result).replace(/,/g, ', '));
                process.stdout.write('\n');
            }
            process.exit(0);
        } catch(error) {
            process.stdout.write(`Could not execute url analysis of modules: ${error}`);
            process.exit(1);
        }
    });

program
    .command('test')
    .description('Run tests')
    .action(async () => {
        const envVar: envVars = new getEnvVars();
        const gitAnalysisClass = new gitAnalysis(envVar);
        const isTokenValid = await gitAnalysisClass.isTokenValid()
        if (isTokenValid === false) {
            process.stdout.write('No valid token provided\n');
            process.exit(1);
        }

        try {
            exec('npx jest --coverage', (error, stdout, stderr) => {
                let totalTests = '0';
                let passedTests = '0';
                let coverage = '0';
    
                (stdout.split('\n')).forEach(element => {
                    if (element.includes("All files")){
                        const coverageArray = element.split('|');
                        coverage = parseInt(coverageArray[coverageArray.length - 2]).toString().trim();
                    }
                });
    
                stderr.split('\n').forEach(element => {
                    if (element.includes("Tests:")){
                        const testMatches = element.match(/(\d+) passed, (\d+) total/);
                        if(testMatches) {
                            passedTests = testMatches[1];
                            totalTests = testMatches[2];
                        }
                    }
                });

                process.stdout.write(`Total: ${totalTests}\n`);
                process.stdout.write(`Passed: ${passedTests}\n`);
                process.stdout.write(`Coverage: ${coverage}%\n`);
                process.stdout.write(`${passedTests}/${totalTests} test cases passed. ${coverage}% line coverage achieved.\n`);
                process.exit(0);
            });
        } catch (error) {
            process.stderr.write(`Tests failed to run: ${error}\n`);
            process.exit(1);
        }
    });

program.parse(process.argv);