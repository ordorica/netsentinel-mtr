export enum ProbeStatus {
  Active = 'Active',
  Paused = 'Paused',
  Error = 'Error'
}

export interface HopData {
  id: number;
  ip: string;
  hostname: string;
  lossPercent: number;
  sent: number;
  lastMs: number;
  avgMs: number;
  bestMs: number;
  worstMs: number;
  stDevMs: number;
}

export interface ProbeResult {
  timestamp: number;
  latency: number; // End-to-end
  jitter: number;
  packetLoss: number; // End-to-end
  hops: HopData[];
  httpStatus?: number;
}

export interface Target {
  id: string;
  userId: string; // Link to User
  isGlobal?: boolean; // If true, visible to all, editable only by admin
  url: string;
  name: string;
  status: ProbeStatus;
  history: ProbeResult[];
  currentQualityScore: number; // 0-100
  uptimePercentage: number;
  createdAt: number;
  
  // Long term stats
  totalProbes: number;
  totalPacketsSent: number;
  totalPacketsLost: number;
}

export interface User {
  id: string;
  email: string; // Can be username for admin
  name: string;
  passwordHash: string;
  role: 'admin' | 'user';
  createdAt: number;
}

export interface AIAnalysisResult {
  targetId: string;
  analysis: string;
  timestamp: number;
}