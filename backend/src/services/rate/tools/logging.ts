import * as fs from 'fs';
import path from 'path';
import { envVars } from '../utils/interfaces';

export enum LogLevel {
    SILENT = 0,
    INFO = 1,
    DEBUG = 2
}

export class logger {
    private logLevel: number;
    private logFile: string;

    constructor(envVars: envVars) {
        this.logLevel = envVars.logLevel? envVars.logLevel : LogLevel.SILENT;
        this.ensureLogFileExists(envVars.logFilePath);
        this.logFile = envVars.logFilePath;
    }

    private makeLogDir(logFilePath: string) {
        const logDir = path.dirname(logFilePath);  // Get the directory of the log file
        if (!fs.existsSync(logDir)) {
            fs.mkdirSync(logDir, { recursive: true });  // Create the directory if it doesn't exist
        }
    }

    private ensureLogFileExists = (logFilePath: string) => {
        if (!fs.existsSync(logFilePath)) {
            // Attempt to create the file by writing an empty string to it
            try {
                fs.writeFileSync(logFilePath, '', { flag: 'w' });
            } catch {
                // If the file can't be created, create the directory and try again
                this.makeLogDir(logFilePath);
            }
        }
    };

    logInfo(message: string) {
        if (this.logLevel >= LogLevel.INFO) {
            this.logMessage(LogLevel.INFO, message);
        }
    }

    logSilent(message: string) {
        if (this.logLevel >= LogLevel.SILENT) {
            this.logMessage(LogLevel.SILENT, message);
        }
    }
    logDebug(message: string, error?: unknown) {
        if (this.logLevel >= LogLevel.DEBUG) {
            this.logMessage(LogLevel.DEBUG, message, error);
        }
    }

    private logMessage(level: LogLevel, message: string, error?: unknown) {
        const now = new Date();
        const dateTime = now.toLocaleDateString() + ' | ' + now.toLocaleTimeString([], { hour12: false });
        let logEntry = `${dateTime} - ${LogLevel[level]} - ${message}`;
        if (error) {
            logEntry+=`${error}`;
        }
        this.writeLog(logEntry);
        return;
    }

    private writeLog(message: string) {
        fs.appendFileSync(this.logFile, message + '\n', 'utf8'); //Makes sures nothing is overwritten
    }
}
