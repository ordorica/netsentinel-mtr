import React from 'react';
import { Target, ProbeStatus } from '../types';
import { Activity, Server, ShieldCheck, Signal } from 'lucide-react';

interface StatsSummaryProps {
  targets: Target[];
  type: 'Global' | 'Personal';
}

const StatsSummary: React.FC<StatsSummaryProps> = ({ targets, type }) => {
  // Calculate aggregates
  const totalTargets = targets.length;
  
  // Calculate functional uptime (targets not showing 100% loss currently)
  const healthyTargets = targets.filter(t => {
    const last = t.history[t.history.length - 1];
    return last ? last.packetLoss < 100 : true;
  }).length;

  const totalPacketsSent = targets.reduce((acc, t) => acc + (t.totalPacketsSent || 0), 0);
  const totalPacketsLost = targets.reduce((acc, t) => acc + (t.totalPacketsLost || 0), 0);
  
  const availabilityRaw = totalPacketsSent > 0 
    ? ((totalPacketsSent - totalPacketsLost) / totalPacketsSent) * 100 
    : 100;

  const availabilityStr = availabilityRaw === 100 && totalPacketsLost > 0
    ? "99.9999%"
    : availabilityRaw.toFixed(availabilityRaw > 99.9 ? 4 : 2) + "%";

  const historicalLossRate = totalPacketsSent > 0 
    ? (totalPacketsLost / totalPacketsSent) * 100 
    : 0;

  // Calculate Current (Live) Stats based on latest probe
  let currentSent = 0;
  let currentLost = 0;

  targets.forEach(t => {
    const last = t.history[t.history.length - 1];
    if (last) {
      // Replicate simulation logic: 100 packets per probe * probeCount
      const config = t.probeConfig || { packetSize: 64, probeCount: 1, timeout: 1000 };
      const batchSize = 100 * (config.probeCount || 1); 
      
      currentSent += batchSize;
      currentLost += Math.round(batchSize * (last.packetLoss / 100));
    }
  });

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
      {/* Card 1: Availability */}
      <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl shadow-sm flex flex-col justify-between relative overflow-hidden group">
        <div className="absolute right-0 top-0 p-3 opacity-10 group-hover:opacity-20 transition-opacity">
          <ShieldCheck size={48} />
        </div>
        <div>
          <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">Availability</p>
          <h3 className={`text-xl md:text-2xl font-bold font-mono mt-1 ${availabilityRaw > 99.9 ? 'text-emerald-400' : 'text-yellow-400'}`}>
            {availabilityStr}
          </h3>
        </div>
        <div className="mt-2 flex items-center gap-1 text-xs text-slate-400">
           <span className="bg-slate-800 px-1.5 py-0.5 rounded text-slate-300">5-Nines</span>
        </div>
      </div>

      {/* Card 2: Live Packet Flow */}
      <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl shadow-sm flex flex-col justify-between relative overflow-hidden group">
         <div className="absolute right-0 top-0 p-3 opacity-10 group-hover:opacity-20 transition-opacity">
          <Activity size={48} />
        </div>
        <div>
          <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">Live Packet Flow</p>
          <div className="mt-2 space-y-1">
             <div className="flex justify-between items-center">
               <span className="text-slate-400 text-xs">Out:</span>
               <span className="text-lg font-mono font-bold text-slate-200">{currentSent.toLocaleString()}</span>
             </div>
              <div className="flex justify-between items-center">
               <span className="text-slate-400 text-xs">Drop:</span>
               <span className={`text-lg font-mono font-bold ${currentLost > 0 ? 'text-red-400' : 'text-slate-200'}`}>
                 {currentLost.toLocaleString()}
               </span>
             </div>
          </div>
        </div>
         <div className="mt-3 pt-2 border-t border-slate-800 flex justify-between items-center text-xs text-slate-500">
          <span>Loss Rate:</span>
          <span className={historicalLossRate > 1 ? 'text-red-400' : 'text-emerald-400'}>{historicalLossRate.toFixed(3)}%</span>
        </div>
      </div>

      {/* Card 3: Infrastructure Health */}
      <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl shadow-sm flex flex-col justify-between relative overflow-hidden group">
         <div className="absolute right-0 top-0 p-3 opacity-10 group-hover:opacity-20 transition-opacity">
          <Server size={48} />
        </div>
        <div>
          <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">Endpoints</p>
          <h3 className="text-xl md:text-2xl font-bold text-slate-200 mt-1">
            {healthyTargets} <span className="text-sm text-slate-500 font-normal">/ {totalTargets}</span>
          </h3>
        </div>
        <div className="mt-2">
           <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
             <div 
               className={`h-full rounded-full ${healthyTargets === totalTargets ? 'bg-emerald-500' : 'bg-yellow-500'}`}
               style={{ width: `${totalTargets > 0 ? (healthyTargets / totalTargets) * 100 : 0}%` }}
             />
           </div>
           <p className="text-[10px] mt-1 text-slate-400 text-right">Healthy</p>
        </div>
      </div>

       {/* Card 4: Signal Quality (Avg) */}
       <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl shadow-sm flex flex-col justify-between relative overflow-hidden group">
         <div className="absolute right-0 top-0 p-3 opacity-10 group-hover:opacity-20 transition-opacity">
          <Signal size={48} />
        </div>
        <div>
          <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">Avg Latency</p>
           {targets.length > 0 ? (
             <h3 className="text-xl md:text-2xl font-bold text-slate-200 mt-1 font-mono">
               {(targets.reduce((acc, t) => {
                 const last = t.history[t.history.length -1];
                 return acc + (last?.latency || 0);
               }, 0) / (targets.length || 1)).toFixed(1)}ms
             </h3>
           ) : (
             <h3 className="text-xl text-slate-600 mt-1">--</h3>
           )}
        </div>
        <div className="mt-2 text-xs text-slate-500">
          Across {totalTargets} {type.toLowerCase()} targets
        </div>
      </div>
    </div>
  );
};

export default StatsSummary;