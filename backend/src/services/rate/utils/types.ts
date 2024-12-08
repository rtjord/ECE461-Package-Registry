export interface Dependency {
  name: string;
  version: string;
}

export interface PullRequestMetrics {
  totalAdditions: number;
  reviewedAdditions: number;
  reviewedFraction: number;
}

export type documentationData = {
  hasReadme: boolean;
  numLines: number;
  hasExamples: boolean;
  hasDocumentation: boolean;
  dependencies: {
    total: number;
    pinned: number;
    fractionPinned: number;
  };
};

export type repoLatencyData = {
  contributors: number;
  openIssues: number;
  closedIssues: number;
  lastCommitDate: number;
  licenses: number;
  numberOfCommits: number;
  numberOfLines: number;
  documentation: number;
  dependencies: number;
  pullRequests: number;
}
