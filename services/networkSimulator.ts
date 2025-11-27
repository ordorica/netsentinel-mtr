import { HopData, ProbeResult, ProbeConfig } from '../types';

// Helper to generate random float
const random = (min: number, max: number) => Math.random() * (max - min) + min;

// Default config if none provided
const DEFAULT_CONFIG: ProbeConfig = {
  packetSize: 64,
  probeCount: 1,
  timeout: 1000
};

// Simulate a single hop
const generateHop = (id: number, baseLatency: number, volatility: number, config: ProbeConfig): HopData => {
  const noise = random(0, volatility);
  let currentMs = baseLatency + noise;
  
  // Packet Size Penalty (Simulated Serialization Delay)
  // Assume ~0.05ms penalty per 100 bytes over standard 64 bytes
  if (config.packetSize > 64) {
    const sizePenalty = ((config.packetSize - 64) / 100) * 0.05;
    currentMs += sizePenalty;
  }

  // Simulate occasional packet loss
  // If latency exceeds timeout, it's a loss
  let isLoss = Math.random() > 0.98; 
  if (currentMs > config.timeout) {
    isLoss = true;
  }
  
  return {
    id,
    ip: `10.0.${id}.${Math.floor(random(1, 255))}`,
    hostname: id === 1 ? 'gateway' : `hop-${id}.backbone.net`,
    lossPercent: isLoss ? random(10, 40) : 0,
    sent: 100, // aggregated over time concept
    lastMs: currentMs,
    avgMs: baseLatency + (noise / 2),
    bestMs: baseLatency,
    worstMs: baseLatency + volatility * 2,
    stDevMs: random(0.1, 5),
  };
};

export const runSimulationProbe = (url: string, config: ProbeConfig = DEFAULT_CONFIG): ProbeResult => {
  const hopCount = 8;
  const baseBaseLatency = random(10, 30); // Starting latency
  const hops: HopData[] = [];
  
  let cumLatency = baseBaseLatency;
  
  for (let i = 1; i <= hopCount; i++) {
    // Latency increases with distance
    cumLatency += random(2, 10);
    // Volatility increases with distance (internet jitter)
    const volatility = random(1, 5) + (i * 0.5);
    hops.push(generateHop(i, cumLatency, volatility, config));
  }

  const finalHop = hops[hops.length - 1];
  
  // Calculate end-to-end metrics derived from the path
  const totalLatency = finalHop.lastMs;
  const jitter = Math.abs(finalHop.lastMs - finalHop.avgMs);
  
  // Simulate end-to-end loss aggregation
  let totalLoss = hops.reduce((acc, hop) => acc + (hop.lossPercent > 0 ? 1 : 0), 0) > 0 ? random(1, 5) : 0;
  
  // Strict timeout check for end-to-end
  if (totalLatency > config.timeout) {
    totalLoss = 100;
  }

  // Determine HTTP Status Code
  let httpStatus = 200;
  
  // Logic to simulate realistic HTTP statuses
  const rand = Math.random();

  if (totalLoss > 20) {
    // High packet loss correlates with connectivity issues
    if (rand > 0.4) httpStatus = 503; // Service Unavailable
    else if (rand > 0.7) httpStatus = 504; // Gateway Timeout
  } else {
    // Mostly healthy, but occasional application or client errors
    if (rand > 0.99) httpStatus = 500; // Internal Server Error
    else if (rand > 0.985) httpStatus = 404; // Not Found
    else if (rand > 0.98) httpStatus = 403; // Forbidden
  }

  return {
    timestamp: Date.now(),
    latency: totalLatency,
    jitter: jitter,
    packetLoss: totalLoss,
    hops: hops,
    httpStatus: httpStatus,
  };
};