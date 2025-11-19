import { HopData, ProbeResult } from '../types';

// Helper to generate random float
const random = (min: number, max: number) => Math.random() * (max - min) + min;

// Simulate a single hop
const generateHop = (id: number, baseLatency: number, volatility: number): HopData => {
  const noise = random(0, volatility);
  const currentMs = baseLatency + noise;
  
  // Simulate occasional packet loss
  const isLoss = Math.random() > 0.98; 
  
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

export const runSimulationProbe = (url: string): ProbeResult => {
  const hopCount = 8;
  const baseBaseLatency = random(10, 30); // Starting latency
  const hops: HopData[] = [];
  
  let cumLatency = baseBaseLatency;
  
  for (let i = 1; i <= hopCount; i++) {
    // Latency increases with distance
    cumLatency += random(2, 10);
    // Volatility increases with distance (internet jitter)
    const volatility = random(1, 5) + (i * 0.5);
    hops.push(generateHop(i, cumLatency, volatility));
  }

  const finalHop = hops[hops.length - 1];
  
  // Calculate end-to-end metrics derived from the path
  const totalLatency = finalHop.lastMs;
  const jitter = Math.abs(finalHop.lastMs - finalHop.avgMs);
  
  // Simulate end-to-end loss aggregation
  const totalLoss = hops.reduce((acc, hop) => acc + (hop.lossPercent > 0 ? 1 : 0), 0) > 0 ? random(1, 5) : 0;

  return {
    timestamp: Date.now(),
    latency: totalLatency,
    jitter: jitter,
    packetLoss: totalLoss,
    hops: hops,
    httpStatus: 200,
  };
};