import { documentationData, repoLatencyData } from "./types";
import { Dependency } from "./types";
import { PullRequestMetrics } from "./types";

export interface npmData {
    repoUrl: string;
    lastCommitDate: string;
    documentation: documentationData;
    dependencies: Dependency[];
    latency: repoLatencyData;
}
export interface repoData {
    dependencies: Dependency[];
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
    pullRequestMetrics: PullRequestMetrics;
}
export interface GitHubPR {
    number: number; // Pull request number
    additions: number; // Number of additions in the PR
    [key: string]: any; // To accommodate any other fields returned by the API
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
    pullRequestMetrics: PullRequestMetrics;
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
    CorrectnessLatency: number;
    BusFactor: number;
    BusFactorLatency: number;
    RampUp: number;
    RampUpLatency: number;
    ResponsiveMaintainer: number;
    ResponsiveMaintainerLatency: number;
    License: number;
    LicenseLatency: number;
    NetScore: number;
    NetScoreLatency: number;
    GoodPinningPractice: number;
    GoodPinningPracticeLatency: number;
    PullRequest: number;
    PullRequestLatency: number;
}
