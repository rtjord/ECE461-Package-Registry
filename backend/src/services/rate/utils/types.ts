export interface Dependency {
  name: string;
  version: string;
}

export type documentationData = {
  hasReadme: boolean;
  numLines: number;
  hasExamples: boolean;
  hasDocumentation: boolean;
  dependecies?: {
    total: number;
    pinned: number;
    outdated: number;
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
  dependecies?: number;
}
