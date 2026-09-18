export interface SystemMemoryInfo {
  rssMb: number;
  heapUsedMb: number;
  heapTotalMb: number;
  heapUtilizationRatio: number;
}

export interface SystemRuntimeInfo {
  nodeVersion: string;
  platform: string;
  arch: string;
  osRelease: string;
  uptimeSeconds: number;
  formattedUptime: string;
}

export interface SystemDatabaseInfo {
  engine: string;
  version?: string;
  status: 'connected' | 'disconnected' | 'degraded';
  activeConnections: number;
  idleConnections: number;
  waitingRequests: number;
  totalConnections: number;
  latestMigration: string;
}

export interface SystemRealtimeInfo {
  enabled: boolean;
  connected: boolean;
  roomsCount: number;
  connectionsCount: number;
  hostLeaseActive?: boolean;
}

export interface SystemDeploymentInfo {
  version: string;
  buildCommit: string;
  gitBranch: string;
  environment: string;
  isDocker: boolean;
  dockerImage?: string;
  edition: string;
  license: string;
  tagline: string;
  links: {
    github: string;
    docs: string;
    issues: string;
    discord: string;
    homelabStack?: string;
  };
}

export interface SystemInfoResponse {
  status: 'ok' | 'error';
  timestamp: number;
  runtime: SystemRuntimeInfo;
  memory: SystemMemoryInfo;
  database: SystemDatabaseInfo;
  realtime: SystemRealtimeInfo;
  deployment: SystemDeploymentInfo;
}

export type ReleaseCategory = 'new' | 'fix' | 'perf' | 'security';

export interface ReleaseChangeItem {
  type: ReleaseCategory;
  description: string;
  reference?: string;
  author?: string;
}

export interface ReleaseNoteEntry {
  version: string;
  releaseDate: string;
  isLatest?: boolean;
  summary: string;
  changes: ReleaseChangeItem[];
}

export type DependencyCategory = 'frontend' | 'backend' | 'rendering' | 'tooling';

export interface StackDependencyItem {
  name: string;
  version: string;
  category: DependencyCategory;
  license: string;
  description: string;
  url?: string;
}
