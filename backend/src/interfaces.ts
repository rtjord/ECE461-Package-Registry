export interface Package {
    metadata: PackageMetadata;
    data: PackageData;
  }
  
  export interface PackageMetadata {
    Name: PackageName;
    Version: string; // e.g., 1.2.3
    ID: PackageID;
  }
  
  export interface PackageData {
    Content?: string; // Base64 encoded package contents
    URL?: string; // Package URL
    debloat?: boolean; // Remove unnecessary bloat
    JSProgram?: string; // JavaScript program for sensitive modules
  }
  
  export interface User {
    name: string; // e.g., Alfalfa
    isAdmin: boolean; // Indicates admin status
  }
  
  export interface UserAuthenticationInfo {
    password: string; // Strong password for user
  }
  
  export type PackageID = string; // Unique ID for package, pattern: '^[a-zA-Z0-9\-]+$'
  
  export type PackageName = string; // Name of a package, "*" reserved
  
  export type AuthenticationToken = string; // Token format e.g., JWT
  
  export interface PackageCost {
    [packageId: string]: {
      standaloneCost?: number; // Standalone cost, excluding dependencies
      totalCost: number; // Total cost including dependencies if applicable
    };
  }
  
  export interface PackageRating {
    BusFactor: number;
    BusFactorLatency: number;
    Correctness: number;
    CorrectnessLatency: number;
    RampUp: number;
    RampUpLatency: number;
    ResponsiveMaintainer: number;
    ResponsiveMaintainerLatency: number;
    LicenseScore: number;
    LicenseScoreLatency: number;
    GoodPinningPractice: number;
    GoodPinningPracticeLatency: number;
    PullRequest: number;
    PullRequestLatency: number;
    NetScore: number;
    NetScoreLatency: number;
  }
  
  export interface PackageHistoryEntry {
    User: User;
    Date: string; // ISO-8601 DateTime in UTC format
    PackageMetadata: PackageMetadata;
    Action: "CREATE" | "UPDATE" | "DOWNLOAD" | "RATE";
  }
  
  export interface AuthenticationRequest {
    User: User;
    Secret: UserAuthenticationInfo;
  }
  
  export type SemverRange = string; // e.g., Exact (1.2.3), Carat (^1.2.3), etc.
  
  export interface PackageQuery {
    Version?: SemverRange;
    Name: PackageName;
  }
  
  export type EnumerateOffset = string; // Offset for pagination, e.g., "1"
  
  export interface PackageRegEx {
    RegEx: string; // Regular expression over package names and READMEs
  }
  