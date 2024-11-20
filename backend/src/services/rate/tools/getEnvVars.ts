import dotenv from 'dotenv';

export class getEnvVars {
    public logLevel: number;
    public logFilePath: string;
    public token: string;

    constructor() {
        dotenv.config();
        const token = process.env.GITHUB_TOKEN;
        if (token === undefined) {
            process.stderr.write(`GITHUB_TOKEN is undefined\n`);
            process.exit(1);
        }
        this.token = token;
        this.logLevel = Number(process.env.LOG_LEVEL);
        const logFilePath = process.env.LOG_FILE;
        if (logFilePath === undefined) {
            process.stderr.write(`LOG_FILE path is undefined\n`);
            process.exit(1);
        }
        this.logFilePath = logFilePath;
    }
}
