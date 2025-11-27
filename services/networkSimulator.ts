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
  
  // Calculate Transmission Delay (Serialization)
  // Simulating link speeds: 
  // Hop 1 (Gateway): ~100 Mbps
  // Backbone: ~1 - 10 Gbps (randomized slightly per hop generation for variety)
  const linkSpeedMbps = id === 1 ? random(80, 120) : random(1000, 10000); 
  const linkSpeedBps = linkSpeedMbps * 1_000_000;
  
  // Transmission Delay = Size (bits) / Bandwidth (bps) * 1000ms
  const transmissionDelayMs = ((config.packetSize * 8) / linkSpeedBps) * 1000;

  // Calculate Queuing Delay & Congestion
  // Larger packets have higher probability of being stuck in queues or fragmented
  const sizeRatio = config.packetSize / 1500;
  
  // Simulation of "Bad Weather" / Congestion Spikes (20% chance per probe)
  const isCongested = Math.random() < 0.2;
  const congestionMultiplier = isCongested ? random(5, 50) : 1; // Massive spike if congested

  // Non-linear penalty: large packets suffer disproportionately more jitter in congestion
  // Base queuing is small (1-5ms), but during congestion can spike to 100s of ms for large packets
  const baseQueuing = random(0.5, 2);
  const queuingDelayMs = baseQueuing + (sizeRatio * 10 * congestionMultiplier); 

  let currentMs = baseLatency + noise + transmissionDelayMs + queuingDelayMs;
  
  // Simulate Packet Loss
  let lossPercent = 0;

  // 1. Hard Timeout
  if (currentMs > config.timeout) {
    lossPercent = 100;
  } 
  // 2. Soft Timeout / Jitter Loss (Latency within 10% of timeout)
  else if (currentMs > config.timeout * 0.9) {
    lossPercent = random(20, 80);
  } 
  // 3. Random background loss (congestion drops)
  else {
    // Probability increases with packet size (tail drop likelihood)
    // Base network flaw (0.5%) + Size Penalty (up to 5%) + Congestion Penalty (up to 15%)
    const baseDrop = 0.005;
    const sizePenalty = sizeRatio * 0.05; 
    const congestionPenalty = isCongested ? random(0.05, 0.15) : 0;
    
    const dropChance = baseDrop + sizePenalty + congestionPenalty;

    if (Math.random() < dropChance) {
      // If a drop occurs, it might be a partial batch loss or full drop
      lossPercent = random(10, 100);
    }
  }
  
  return {
    id,
    ip: `10.0.${id}.${Math.floor(random(1, 255))}`,
    hostname: id === 1 ? 'gateway' : `hop-${id}.backbone.net`,
    lossPercent: parseFloat(lossPercent.toFixed(1)),
    sent: 100, // aggregated over time concept
    lastMs: parseFloat(currentMs.toFixed(2)),
    avgMs: parseFloat((baseLatency + (noise / 2)).toFixed(2)),
    bestMs: parseFloat(baseLatency.toFixed(2)),
    worstMs: parseFloat((baseLatency + volatility * 2 + queuingDelayMs).toFixed(2)),
    stDevMs: parseFloat((random(0.1, 5) + (queuingDelayMs * 0.2)).toFixed(2)),
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
  
  // End-to-end packet loss is primarily determined by the final hop's success
  let totalLoss = finalHop.lossPercent;
  
  // Safety check: if latency strictly exceeds timeout, force 100% loss
  if (totalLatency > config.timeout) {
    totalLoss = 100;
  }

  // Determine HTTP Status Code based on loss and random chance
  let httpStatus = 200;
  const rand = Math.random();

  if (totalLoss >= 100) {
      httpStatus = 0; // Connection Error / Timeout
  } else if (totalLoss > 20) {
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