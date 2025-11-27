import { GoogleGenAI } from "@google/genai";
import { Target } from '../types';

export const analyzeNetworkHealth = async (target: Target): Promise<string> => {
  try {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    
    // Analyze larger history window (approx 60 seconds / 30 probes)
    const historyWindow = target.history.slice(-30);
    if (historyWindow.length === 0) return "No data available for analysis.";

    const latest = historyWindow[historyWindow.length - 1];
    
    // Calculate Packet Loss Trend
    const halfIndex = Math.floor(historyWindow.length / 2);
    const firstHalf = historyWindow.slice(0, halfIndex);
    const secondHalf = historyWindow.slice(halfIndex);

    const avgLossFirst = firstHalf.reduce((acc, h) => acc + h.packetLoss, 0) / (firstHalf.length || 1);
    const avgLossSecond = secondHalf.reduce((acc, h) => acc + h.packetLoss, 0) / (secondHalf.length || 1);
    
    let lossTrend = "Stable";
    if (avgLossSecond > avgLossFirst + 5) lossTrend = `Worsening (${avgLossFirst.toFixed(1)}% -> ${avgLossSecond.toFixed(1)}%)`;
    else if (avgLossFirst > avgLossSecond + 5) lossTrend = `Improving (${avgLossFirst.toFixed(1)}% -> ${avgLossSecond.toFixed(1)}%)`;
    else if (avgLossSecond > 0 || avgLossFirst > 0) lossTrend = `Consistent Loss (~${avgLossSecond.toFixed(1)}%)`;

    // Standard Deviation of latency in window (Jitter consistency)
    const latencies = historyWindow.map(h => h.latency);
    const avgLatency = latencies.reduce((a, b) => a + b, 0) / latencies.length;
    const variance = latencies.reduce((a, b) => a + Math.pow(b - avgLatency, 2), 0) / latencies.length;
    const stDevLatency = Math.sqrt(variance);

    const prompt = `
      Act as a Senior Network Reliability Engineer. Analyze the following simulated MTR (My Traceroute) data for target: ${target.name} (${target.url}).
      
      Time Window Analysis (Last ~60 seconds, ${historyWindow.length} samples):
      - Packet Loss Trend: ${lossTrend}
      - Latency Stability (StDev): ${stDevLatency.toFixed(2)}ms
      - Latest HTTP Status: ${latest.httpStatus}
      
      Current Snapshot:
      - End-to-End Latency: ${latest.latency.toFixed(2)}ms
      - Current Jitter: ${latest.jitter.toFixed(2)}ms
      - Current Packet Loss: ${latest.packetLoss.toFixed(2)}%
      - Uptime (Long Term): ${target.uptimePercentage.toFixed(4)}%
      
      Last Hop Data (Hop #${latest.hops.length}):
      - Host: ${latest.hops[latest.hops.length - 1]?.hostname}
      - Avg Latency: ${latest.hops[latest.hops.length - 1]?.avgMs.toFixed(2)}ms
      
      Instructions:
      1. Determine if the packet loss is intermittent (spiky) or continuous.
      2. If HTTP status is not 200, factor that into the severity.
      3. Provide a concise, technical root cause estimation (e.g., congestion, bad route, or clean connection).
      4. Keep the response strictly under 3 sentences.
    `;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: {
        temperature: 0.3, // Low temperature for more factual/technical output
      }
    });

    return response.text || "Analysis failed to generate text.";
  } catch (error) {
    console.error("Gemini Analysis Error:", error);
    return "Failed to contact AI service for analysis.";
  }
};