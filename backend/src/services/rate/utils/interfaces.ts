import { documentationData, repoLatencyData } from "./types";
import { Dependency } from "./types";

export interface npmData {
    repoUrl: string;
    lastCommitDate: string;
    documentation: documentationData;
    latency: repoLatencyData;
}
export interface repoData {
    dependencies?: Dependency[];
    repoName: string;
    repoUrl: string;
    repoOwner: string;
    numberOfContributors: number;
    numberOfOpenIssues: number;
    numberOfClosedIssues: number;
    lastCommitDate: string;
    licenses: string[];
    numberOfCommits: number;
    numberOfLines: number;
    documentation: documentationData;
    latency: repoLatencyData;
}

export interface gitData {
    repoName: string;
    repoUrl: string;
    repoOwner: string;
    numberOfContributors: number;
    numberOfOpenIssues: number;
    numberOfClosedIssues: number;
    licenses: string[];
    numberOfCommits: number;
    numberOfLines: number;
    latency: repoLatencyData;
}

export interface npmData {
    repoUrl: string;
    lastCommitDate: string;
    documentation: documentationData;
    latency: repoLatencyData;
}

export interface envVars {
    token: string;
    logLevel: number;
    logFilePath: string;
}

export interface metricData{
    URL: string;
    Correctness: number;
    Correctness_Latency: number;
    BusFactor: number;
    BusFactor_Latency: number;
    RampUp: number;
    RampUp_Latency: number;
    ResponsiveMaintainer: number;
    ResponsiveMaintainer_Latency: number;
    License: number;
    License_Latency: number;
    NetScore: number;
    NetScore_Latency: number;
    GoodPinningPractice: number;
    GoodPinningPractice_Latency: number;
}
