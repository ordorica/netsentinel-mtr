import { GoogleGenAI } from "@google/genai";
import { Target } from '../types';

export const analyzeNetworkHealth = async (target: Target): Promise<string> => {
  try {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    
    // Prepare a summary of the last 10 probes
    const recentHistory = target.history.slice(-10);
    if (recentHistory.length === 0) return "No data available for analysis.";

    const latest = recentHistory[recentHistory.length - 1];
    
    const prompt = `
      Act as a Senior Network Reliability Engineer. Analyze the following simulated MTR (My Traceroute) data for target: ${target.name} (${target.url}).
      
      Current Stats:
      - End-to-End Latency: ${latest.latency.toFixed(2)}ms
      - Jitter: ${latest.jitter.toFixed(2)}ms
      - Packet Loss: ${latest.packetLoss.toFixed(2)}%
      - Uptime: ${target.uptimePercentage.toFixed(2)}%
      
      Last Hop Data (Hop #${latest.hops.length}):
      - Host: ${latest.hops[latest.hops.length - 1]?.hostname}
      - Avg Latency: ${latest.hops[latest.hops.length - 1]?.avgMs.toFixed(2)}ms
      - Worst Latency: ${latest.hops[latest.hops.length - 1]?.worstMs.toFixed(2)}ms
      
      Provide a concise, technical summary of the connection quality. Identify if there are signs of congestion, routing instability, or if the connection is healthy. Keep it under 3 sentences.
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