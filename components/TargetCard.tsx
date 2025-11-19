import React, { useState } from 'react';
import { Target } from '../types';
import { ChevronDown, ChevronUp, Globe, AlertCircle, Cpu, Shield, BarChart3, GripVertical } from 'lucide-react';
import { LineChart, Line, ResponsiveContainer, YAxis, Tooltip } from 'recharts';
import { analyzeNetworkHealth } from '../services/geminiService';

interface TargetCardProps {
  target: Target;
  onDelete: (id: string) => void;
  isReadOnly?: boolean;
  draggable?: boolean;
  onDragStart?: (e: React.DragEvent) => void;
  onDragEnter?: (e: React.DragEvent) => void;
  onDragEnd?: (e: React.DragEvent) => void;
}

const TargetCard: React.FC<TargetCardProps> = ({ 
  target, 
  onDelete, 
  isReadOnly = false,
  draggable = false,
  onDragStart,
  onDragEnter,
  onDragEnd
}) => {
  const [expanded, setExpanded] = useState(false);
  const [aiAnalysis, setAiAnalysis] = useState<string | null>(null);
  const [loadingAi, setLoadingAi] = useState(false);

  const lastResult = target.history[target.history.length - 1];
  
  // Calculate status color
  let statusColor = "bg-green-500";
  if (lastResult?.packetLoss > 10) statusColor = "bg-red-500";
  else if (lastResult?.latency > 150 || lastResult?.jitter > 30) statusColor = "bg-yellow-500";

  // Calculate 5 Nines Availability
  const totalPackets = target.totalPacketsSent || 1; // avoid divide by zero
  const totalLost = target.totalPacketsLost || 0;
  const availability = ((totalPackets - totalLost) / totalPackets) * 100;
  
  // Format to varying decimal places depending on how many nines we have
  const availabilityStr = availability === 100 && totalLost > 0 
    ? "99.9999%" 
    : availability.toFixed(availability > 99.9 ? 5 : 2) + "%";

  const handleAiAnalyze = async () => {
    setLoadingAi(true);
    const result = await analyzeNetworkHealth(target);
    setAiAnalysis(result);
    setLoadingAi(false);
  };

  if (!lastResult) return <div className="p-4 bg-slate-900 rounded-lg animate-pulse">Initializing probe...</div>;

  return (
    <div 
      className={`bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-sm hover:shadow-md transition-all duration-300 ${draggable ? 'cursor-move active:cursor-grabbing active:scale-[0.99] active:bg-slate-800' : ''}`}
      draggable={draggable}
      onDragStart={onDragStart}
      onDragEnter={onDragEnter}
      onDragEnd={onDragEnd}
    >
      {/* Summary Header */}
      <div 
        className="p-4 flex flex-col md:flex-row md:items-center justify-between cursor-pointer bg-slate-900 hover:bg-slate-800/50 transition-colors"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center gap-4 mb-4 md:mb-0">
          
          {/* Drag Handle */}
          {draggable && !isReadOnly && (
            <div className="text-slate-600 hover:text-slate-400 cursor-grab active:cursor-grabbing">
              <GripVertical size={20} />
            </div>
          )}

          <div className={`w-3 h-3 rounded-full ${statusColor} shadow-[0_0_8px_rgba(255,255,255,0.3)]`} />
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-lg font-semibold text-slate-100 flex items-center gap-2">
                <Globe className="w-4 h-4 text-slate-400" />
                {target.name}
              </h3>
              {target.isGlobal && (
                <span className="text-[10px] uppercase bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 px-2 py-0.5 rounded-full font-bold flex items-center gap-1">
                  <Shield size={10} /> Global
                </span>
              )}
            </div>
            <p className="text-xs text-slate-500 font-mono">{target.url}</p>
          </div>
        </div>

        <div className="flex items-center gap-6 text-sm">
          <div className="text-center">
            <p className="text-slate-500 text-xs uppercase tracking-wider">Avg Latency</p>
            <p className="font-mono font-medium text-slate-200">{lastResult.latency.toFixed(1)}ms</p>
          </div>
          <div className="text-center hidden sm:block">
            <p className="text-slate-500 text-xs uppercase tracking-wider">Loss</p>
            <p className={`font-mono font-medium ${lastResult.packetLoss > 0 ? 'text-red-400' : 'text-slate-200'}`}>
              {lastResult.packetLoss.toFixed(1)}%
            </p>
          </div>
           <div className="text-center hidden sm:block">
            <p className="text-slate-500 text-xs uppercase tracking-wider">Availability</p>
             <div className="flex items-center gap-1">
              <p className={`font-mono font-bold ${availability > 99 ? 'text-emerald-400' : 'text-yellow-400'}`}>{availabilityStr}</p>
             </div>
          </div>
          
          <div className="text-slate-400">
            {expanded ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
          </div>
        </div>
      </div>

      {/* Detailed Breakdown (Hidden Pulldown) */}
      {expanded && (
        <div className="border-t border-slate-800 bg-slate-950/50 p-6 animate-in slide-in-from-top-2 duration-200 cursor-default" onClick={(e) => e.stopPropagation()}>
          
          {/* Quick Charts Area */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
            
            {/* Latency Chart */}
            <div className="bg-slate-900/50 rounded-lg p-4 border border-slate-800">
              <h4 className="text-xs font-bold text-slate-400 uppercase mb-4">Latency History (Last 20 Probes)</h4>
              <div className="h-32 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={target.history.slice(-20)}>
                    <YAxis hide domain={['dataMin - 5', 'dataMax + 5']} />
                    <Tooltip 
                      contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', color: '#f1f5f9' }} 
                      itemStyle={{ color: '#818cf8' }}
                      labelStyle={{ display: 'none' }}
                    />
                    <Line type="monotone" dataKey="latency" stroke="#818cf8" strokeWidth={2} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Long Term Stats */}
             <div className="bg-slate-900/50 rounded-lg p-4 border border-slate-800">
              <h4 className="text-xs font-bold text-slate-400 uppercase mb-4 flex items-center gap-2">
                <BarChart3 size={14}/> Cumulative Stats
              </h4>
              <div className="space-y-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-slate-500">Total Probes</span>
                  <span className="font-mono text-slate-200">{target.totalProbes.toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Packets Sent</span>
                  <span className="font-mono text-slate-200">{target.totalPacketsSent.toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                   <span className="text-slate-500">Packets Lost</span>
                  <span className="font-mono text-red-400">{target.totalPacketsLost.toLocaleString()}</span>
                </div>
                <div className="flex justify-between border-t border-slate-800 pt-2 mt-2">
                   <span className="text-slate-500 font-medium">Availability</span>
                  <span className="font-mono text-emerald-400 font-bold">{availabilityStr}</span>
                </div>
              </div>
            </div>

            {/* AI Analysis Section */}
            <div className="bg-gradient-to-br from-slate-900 to-slate-800 rounded-lg p-4 border border-slate-700 relative overflow-hidden">
              <div className="flex items-center justify-between mb-2">
                <h4 className="text-xs font-bold text-sky-400 uppercase flex items-center gap-2">
                  <Cpu size={14} /> AI Network Insight
                </h4>
                {!aiAnalysis && !loadingAi && (
                  <button 
                    onClick={handleAiAnalyze}
                    className="text-xs bg-sky-600 hover:bg-sky-500 text-white px-2 py-1 rounded transition-colors"
                  >
                    Analyze
                  </button>
                )}
              </div>
              
              {loadingAi ? (
                <div className="flex items-center justify-center h-24 text-sky-500 gap-2">
                   <div className="w-4 h-4 border-2 border-sky-500 border-t-transparent rounded-full animate-spin"></div>
                   <span className="text-xs">Thinking...</span>
                </div>
              ) : aiAnalysis ? (
                <p className="text-sm text-slate-300 leading-relaxed animate-in fade-in">
                  {aiAnalysis}
                </p>
              ) : (
                <p className="text-sm text-slate-500 italic">
                  Click analyze to get a breakdown of the connection quality using Gemini 2.5.
                </p>
              )}
            </div>
          </div>

          {/* MTR Table */}
          <div className="overflow-x-auto rounded-lg border border-slate-800">
            <table className="w-full text-sm text-left text-slate-400">
              <thead className="text-xs text-slate-300 uppercase bg-slate-900 border-b border-slate-800">
                <tr>
                  <th scope="col" className="px-6 py-3">Hop</th>
                  <th scope="col" className="px-6 py-3">Host</th>
                  <th scope="col" className="px-6 py-3 text-right">Loss%</th>
                  <th scope="col" className="px-6 py-3 text-right">Sent</th>
                  <th scope="col" className="px-6 py-3 text-right">Last</th>
                  <th scope="col" className="px-6 py-3 text-right">Avg</th>
                  <th scope="col" className="px-6 py-3 text-right">Best</th>
                  <th scope="col" className="px-6 py-3 text-right">Wrst</th>
                  <th scope="col" className="px-6 py-3 text-right">StDev</th>
                </tr>
              </thead>
              <tbody>
                {lastResult.hops.map((hop) => (
                  <tr key={hop.id} className="bg-slate-950 border-b border-slate-900 hover:bg-slate-900/40">
                    <td className="px-6 py-2 font-mono">{hop.id}</td>
                    <td className="px-6 py-2 font-mono text-slate-300">{hop.hostname || hop.ip}</td>
                    <td className={`px-6 py-2 text-right font-mono ${hop.lossPercent > 0 ? 'text-red-400 font-bold' : 'text-slate-500'}`}>
                      {hop.lossPercent.toFixed(1)}%
                    </td>
                    <td className="px-6 py-2 text-right font-mono">{hop.sent}</td>
                    <td className="px-6 py-2 text-right font-mono text-slate-200">{hop.lastMs.toFixed(1)}</td>
                    <td className="px-6 py-2 text-right font-mono">{hop.avgMs.toFixed(1)}</td>
                    <td className="px-6 py-2 text-right font-mono text-green-400">{hop.bestMs.toFixed(1)}</td>
                    <td className="px-6 py-2 text-right font-mono text-red-400">{hop.worstMs.toFixed(1)}</td>
                    <td className="px-6 py-2 text-right font-mono text-slate-500">{hop.stDevMs.toFixed(1)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {!isReadOnly && (
            <div className="mt-4 flex justify-end">
               <button 
                 onClick={() => onDelete(target.id)}
                 className="text-xs text-red-500 hover:text-red-400 flex items-center gap-1"
               >
                  <AlertCircle size={12} /> Remove Target
               </button>
            </div>
          )}

        </div>
      )}
    </div>
  );
};

export default TargetCard;