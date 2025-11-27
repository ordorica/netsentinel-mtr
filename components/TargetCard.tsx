import React, { useState, useEffect } from 'react';
import { Target, ProbeStatus, ProbeResult } from '../types';
import { ChevronDown, ChevronUp, AlertCircle, Cpu, Shield, BarChart3, GripVertical, Settings, History, Pause, Play, Globe, TrendingUp, TrendingDown, Minus, CheckCircle2 } from 'lucide-react';
import { LineChart, Line, ResponsiveContainer, YAxis, Tooltip, XAxis, Brush, CartesianGrid, AreaChart, Area } from 'recharts';
import { analyzeNetworkHealth } from '../services/geminiService';

interface TargetCardProps {
  target: Target;
  onDelete: (id: string) => void;
  onEditConfig?: (target: Target) => void;
  onToggleStatus?: (id: string) => void;
  onAnalyzeComplete?: (targetId: string, result: string) => void;
  isReadOnly?: boolean;
  draggable?: boolean;
  onDragStart?: (e: React.DragEvent) => void;
  onDragEnter?: (e: React.DragEvent) => void;
  onDragEnd?: (e: React.DragEvent) => void;
}

const TargetCard: React.FC<TargetCardProps> = ({ 
  target, 
  onDelete, 
  onEditConfig,
  onToggleStatus,
  onAnalyzeComplete,
  isReadOnly = false,
  draggable = false,
  onDragStart,
  onDragEnter,
  onDragEnd
}) => {
  const [expanded, setExpanded] = useState(false);
  const [loadingAi, setLoadingAi] = useState(false);
  
  // State for chart interaction freezing
  const [isHoveringChart, setIsHoveringChart] = useState(false);
  const [chartData, setChartData] = useState<ProbeResult[]>([]);

  // Update chart data only if not hovering (interacting)
  useEffect(() => {
    if (!isHoveringChart) {
      setChartData(target.history);
    }
  }, [target.history, isHoveringChart]);

  const lastResult = target.history[target.history.length - 1];
  const config = target.probeConfig || { packetSize: 64, probeCount: 1, timeout: 1000 };
  const slaTarget = target.slaTarget ?? 99.999;
  
  // Get latest analysis if exists
  const latestAnalysis = target.aiAnalysisHistory && target.aiAnalysisHistory.length > 0 
    ? target.aiAnalysisHistory[0] 
    : null;
    
  // Previous analyses (skip the first one which is latest)
  const previousAnalyses = target.aiAnalysisHistory && target.aiAnalysisHistory.length > 1
    ? target.aiAnalysisHistory.slice(1, 4) // Show up to 3 previous
    : [];

  // Calculate status color (Latency/Jitter based)
  let statusIndicatorColor = "bg-green-500";
  if (target.status === ProbeStatus.Paused) statusIndicatorColor = "bg-slate-500";
  else if (lastResult?.packetLoss > 10) statusIndicatorColor = "bg-red-500";
  else if (lastResult?.latency > 150 || lastResult?.jitter > 30) statusIndicatorColor = "bg-yellow-500";

  // Calculate 5 Nines Availability
  const totalPackets = target.totalPacketsSent || 1; // avoid divide by zero
  const totalLost = target.totalPacketsLost || 0;
  const availability = ((totalPackets - totalLost) / totalPackets) * 100;
  
  // Dynamic Critical Threshold Calculation (Simulated AI Threshold)
  const criticalThreshold = slaTarget > 99 ? 98.0 : Math.max(0, slaTarget - 5.0);

  // Determine Availability Color Text
  let availabilityColor = 'text-emerald-400';
  if (availability < criticalThreshold) {
      availabilityColor = 'text-red-500 font-extrabold animate-pulse'; // Serious Issue
  } else if (availability < slaTarget) {
      availabilityColor = 'text-yellow-400'; // Warning: Below SLA but not critical
  }

  // Jitter Health & Trend Logic
  const jitterValue = lastResult?.jitter || 0;
  let jitterColor = "text-emerald-400";
  let jitterBarColor = "bg-emerald-500";
  let jitterLabel = "Stable";
  
  if (jitterValue > 30) { 
      jitterColor = "text-red-400"; 
      jitterBarColor = "bg-red-500";
      jitterLabel = "Poor";
  } else if (jitterValue > 10) { 
      jitterColor = "text-yellow-400"; 
      jitterBarColor = "bg-yellow-500";
      jitterLabel = "Fair";
  }

  // Calculate Jitter Trend (compare first half of recent history to second half)
  const recentHistory = target.history.slice(-20);
  let jitterTrend: 'Stable' | 'Rising' | 'Falling' = 'Stable';
  
  if (recentHistory.length >= 10) {
      const split = Math.floor(recentHistory.length / 2);
      const earlyStats = recentHistory.slice(0, split);
      const recentStats = recentHistory.slice(split);
      
      const earlyAvg = earlyStats.reduce((sum, h) => sum + h.jitter, 0) / earlyStats.length;
      const recentAvg = recentStats.reduce((sum, h) => sum + h.jitter, 0) / recentStats.length;
      
      // Threshold of 2ms change to be considered a trend
      if (recentAvg > earlyAvg + 2) jitterTrend = 'Rising';
      else if (earlyAvg > recentAvg + 2) jitterTrend = 'Falling';
  }

  // Format to varying decimal places depending on how many nines we have
  const availabilityStr = availability === 100 && totalLost > 0 
    ? "99.9999%" 
    : availability.toFixed(availability > 99.9 ? 5 : 3) + "%";

  // Timestamp calculations
  const lastSentTime = lastResult?.timestamp;
  // Find last time we received a packet (loss < 100)
  const lastSeenTime = target.history.slice().reverse().find(h => h.packetLoss < 100)?.timestamp;

  const handleAiAnalyze = async () => {
    setLoadingAi(true);
    const result = await analyzeNetworkHealth(target);
    if (onAnalyzeComplete) {
      onAnalyzeComplete(target.id, result);
    }
    setLoadingAi(false);
  };

  const formatDate = (timestamp: number) => {
    return new Intl.DateTimeFormat('en-US', {
      month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
    }).format(new Date(timestamp));
  };

  const formatTimeOnly = (timestamp?: number) => {
    if (!timestamp) return '--:--:--';
    return new Date(timestamp).toLocaleTimeString('en-US', { hour12: false });
  };

  // Determine Icon based on Global status
  const TargetIcon = target.isGlobal ? Shield : Globe;
  const iconColor = target.isGlobal ? "text-indigo-400" : "text-slate-400";

  if (!lastResult && target.status === ProbeStatus.Active) return <div className="p-4 bg-slate-900 rounded-lg animate-pulse">Initializing probe...</div>;
  if (!lastResult && target.status === ProbeStatus.Paused) return <div className="p-4 bg-slate-900 rounded-lg text-slate-500">Monitoring Paused</div>;

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
        className="px-4 py-3 flex flex-col md:flex-row md:items-center gap-2 cursor-pointer bg-slate-900 hover:bg-slate-800/50 transition-colors"
        onClick={() => setExpanded(!expanded)}
      >
        {/* Left Section: Target Info */}
        <div className="flex items-center gap-3 flex-1 min-w-0 md:mb-0">
          
          {/* Drag Handle */}
          {draggable && !isReadOnly && (
            <div className="text-slate-600 hover:text-slate-400 cursor-grab active:cursor-grabbing flex-shrink-0">
              <GripVertical size={20} />
            </div>
          )}

          <div className={`w-3 h-3 rounded-full ${statusIndicatorColor} shadow-[0_0_8px_rgba(255,255,255,0.3)] flex-shrink-0`} />
          
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <h3 className="text-lg font-semibold text-slate-100 flex items-center gap-2 truncate">
                <TargetIcon className={`w-4 h-4 ${iconColor} flex-shrink-0`} />
                <span className="truncate">{target.name}</span>
                {target.status === ProbeStatus.Paused && (
                    <span className="px-1.5 py-0.5 rounded bg-slate-800 text-[10px] text-slate-400 uppercase font-bold tracking-wider">Paused</span>
                )}
              </h3>
            </div>
            <p className="text-xs text-slate-500 font-mono truncate">{target.url}</p>
          </div>
        </div>

        {/* Right Section: Metrics */}
        {/* Updated layout to fill width on mobile and position sparkline in empty space */}
        <div className="flex items-center gap-2 md:gap-6 text-sm flex-shrink-0 md:ml-auto w-full md:w-auto mt-2 md:mt-0">
          
          <div className="text-center min-w-[60px]">
            <p className="text-slate-500 text-[10px] uppercase tracking-wider">Avg Latency</p>
            <p className="font-mono font-medium text-slate-200">{lastResult.latency.toFixed(1)}ms</p>
          </div>

          <div className="text-center min-w-[40px]">
            <p className="text-slate-500 text-[10px] uppercase tracking-wider">Loss</p>
            <p className={`font-mono font-medium ${lastResult.packetLoss > 0 ? 'text-red-400' : 'text-slate-200'}`}>
              {lastResult.packetLoss.toFixed(1)}%
            </p>
          </div>

          <div className="text-center min-w-[50px] hidden sm:block">
            <p className="text-slate-500 text-[10px] uppercase tracking-wider">Jitter</p>
            <div className="flex items-center justify-center gap-1">
                <p className={`font-mono font-medium ${jitterValue > 30 ? 'text-yellow-400' : 'text-slate-200'}`}>{jitterValue.toFixed(1)}ms</p>
                {jitterTrend === 'Rising' && <TrendingUp size={12} className="text-yellow-400" />}
                {jitterTrend === 'Falling' && <TrendingDown size={12} className="text-emerald-400" />}
                {jitterTrend === 'Stable' && <CheckCircle2 size={12} className="text-emerald-400 opacity-50" />}
            </div>
          </div>

           <div className="text-center min-w-[70px]">
            <p className="text-slate-500 text-[10px] uppercase tracking-wider">Availability</p>
             <div className="flex flex-col items-end">
              <p className={`font-mono font-bold ${availabilityColor}`}>{availabilityStr}</p>
              <span className="text-[9px] text-slate-600 font-mono">SLA: {slaTarget}%</span>
             </div>
          </div>

          {/* Sparkline & Avg Latency Group - Moved to end to fill space */}
          {/* Fills remaining space on mobile (flex-1), fixed width on desktop */}
          <div className="flex-1 h-8 min-w-[60px] max-w-[200px] md:w-24 md:flex-none relative overflow-hidden opacity-50 ml-2">
            <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={target.history.slice(-20)}>
                    <defs>
                    <linearGradient id={`colorLatency-${target.id}`} x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#6366f1" stopOpacity={0.6}/>
                        <stop offset="95%" stopColor="#6366f1" stopOpacity={0}/>
                    </linearGradient>
                    </defs>
                    <Area 
                    type="monotone" 
                    dataKey="latency" 
                    stroke="#6366f1" 
                    fillOpacity={1} 
                    fill={`url(#colorLatency-${target.id})`} 
                    strokeWidth={1.5}
                    isAnimationActive={false}
                    />
                </AreaChart>
            </ResponsiveContainer>
          </div>
          
          <div className="text-slate-400 pl-1">
            {expanded ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
          </div>
        </div>
      </div>

      {/* Detailed Breakdown (Hidden Pulldown) */}
      {expanded && (
        <div className="border-t border-slate-800 bg-slate-950/50 p-6 animate-in slide-in-from-top-2 duration-200 cursor-default" onClick={(e) => e.stopPropagation()}>
          
          {/* Quick Charts Area */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
            
            {/* Latency Chart with Zoom */}
            <div className="bg-slate-900/50 rounded-lg p-4 border border-slate-800">
              <div className="flex justify-between items-start mb-4">
                 <h4 className="text-xs font-bold text-slate-400 uppercase">Latency History (Interactive)</h4>
                 {isHoveringChart && (
                     <span className="text-[10px] text-indigo-400 bg-indigo-500/10 px-2 py-0.5 rounded animate-pulse">Live updates paused for inspection</span>
                 )}
              </div>
              
              <div 
                className="h-48 w-full"
                onMouseEnter={() => setIsHoveringChart(true)}
                onMouseLeave={() => setIsHoveringChart(false)}
              >
                <ResponsiveContainer width="100%" height="100%" minWidth={0}>
                  <LineChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                    <XAxis 
                        dataKey="timestamp" 
                        tickFormatter={(time) => new Date(time).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit', second:'2-digit'})}
                        stroke="#475569" 
                        fontSize={10} 
                        minTickGap={30}
                    />
                    <YAxis 
                        stroke="#475569" 
                        fontSize={10} 
                        domain={['auto', 'auto']}
                        label={{ value: 'ms', angle: -90, position: 'insideLeft', fill: '#64748b', fontSize: 10, dy: 10 }} 
                    />
                    <Tooltip 
                      contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', color: '#f1f5f9' }} 
                      itemStyle={{ color: '#818cf8' }}
                      labelFormatter={(label) => new Date(label).toLocaleTimeString()}
                    />
                    <Line type="monotone" dataKey="latency" stroke="#818cf8" strokeWidth={2} dot={false} activeDot={{ r: 4 }} animationDuration={500} />
                    <Brush 
                        dataKey="timestamp" 
                        height={20} 
                        stroke="#4f46e5" 
                        fill="#0f172a" 
                        tickFormatter={() => ''}
                        travellerWidth={10}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Config & Stats */}
             <div className="bg-slate-900/50 rounded-lg p-4 border border-slate-800 flex flex-col justify-between">
              <div>
                <div className="flex justify-between items-start mb-4">
                  <h4 className="text-xs font-bold text-slate-400 uppercase flex items-center gap-2">
                    <BarChart3 size={14}/> Cumulative Stats
                  </h4>
                  <div className="flex items-center gap-1">
                    {/* Pause/Resume Button */}
                    {!isReadOnly && onToggleStatus && (
                         <button 
                         onClick={() => onToggleStatus(target.id)}
                         className={`p-1 rounded transition-colors ${target.status === ProbeStatus.Paused ? 'text-green-400 hover:bg-green-500/10' : 'text-yellow-400 hover:bg-yellow-500/10'}`}
                         title={target.status === ProbeStatus.Paused ? "Resume Monitoring" : "Pause Monitoring"}
                        >
                            {target.status === ProbeStatus.Paused ? <Play size={14} fill="currentColor" /> : <Pause size={14} fill="currentColor" />}
                        </button>
                    )}
                    {/* Settings Button */}
                    {!isReadOnly && onEditConfig && (
                        <button 
                        onClick={() => onEditConfig(target)}
                        className="text-slate-500 hover:text-indigo-400 transition-colors p-1 hover:bg-slate-800 rounded"
                        title="Configure Probe Settings"
                        >
                        <Settings size={14} />
                        </button>
                    )}
                  </div>
                </div>
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
                  
                  {/* Detailed Jitter Stats with Visual Bar */}
                  <div className="py-2">
                    <div className="flex justify-between items-center mb-1">
                      <span className="text-slate-500">Jitter (ms)</span>
                      <div className="flex items-center gap-2">
                         <span className={`text-xs font-bold ${jitterColor}`}>
                             {jitterLabel}
                         </span>
                         <span className={`font-mono ${jitterColor}`}>{jitterValue.toFixed(2)}ms</span>
                      </div>
                    </div>
                    {/* Visual Indicator Bar */}
                    <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden flex">
                        <div 
                            className={`h-full ${jitterBarColor} transition-all duration-500 ease-out`} 
                            style={{ width: `${Math.min(100, (jitterValue / 50) * 100)}%` }}
                        />
                    </div>
                    {/* Trend Line */}
                    <div className="flex justify-between text-[10px] mt-1">
                        <span className="text-slate-600">Trend (Last 60s)</span>
                        <span className={`font-medium flex items-center gap-1 ${
                            jitterTrend === 'Rising' ? 'text-yellow-400' : 
                            jitterTrend === 'Falling' ? 'text-emerald-400' : 'text-slate-500'
                        }`}>
                            {jitterTrend === 'Rising' && <TrendingUp size={10} />}
                            {jitterTrend === 'Falling' && <TrendingDown size={10} />}
                            {jitterTrend === 'Stable' && <CheckCircle2 size={10} className="text-emerald-400" />}
                            {jitterTrend}
                        </span>
                    </div>
                  </div>

                  <div className="border-t border-slate-800 my-2 pt-2"></div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Last Packet Sent</span>
                    <span className="font-mono text-indigo-300">{formatTimeOnly(lastSentTime)}</span>
                  </div>
                   <div className="flex justify-between">
                    <span className="text-slate-500">Last Packet Seen</span>
                    <span className={`font-mono ${lastSeenTime ? 'text-emerald-300' : 'text-slate-600'}`}>
                        {lastSeenTime ? formatTimeOnly(lastSeenTime) : 'Never'}
                    </span>
                  </div>
                </div>
              </div>
              
              {/* Config Display */}
              <div className="mt-4 pt-3 border-t border-slate-800">
                  <div className="grid grid-cols-4 gap-2 text-center text-[10px] text-slate-500">
                     <div className="bg-slate-950 py-1 rounded border border-slate-800 col-span-2 flex justify-between px-2 items-center">
                        <div>SLA</div>
                        <div className="font-bold text-indigo-400">{slaTarget}%</div>
                     </div>
                     <div className="bg-slate-950 py-1 rounded border border-slate-800">
                        <div className="font-bold text-slate-300">{config.packetSize}B</div>
                        <div>Size</div>
                     </div>
                     <div className="bg-slate-950 py-1 rounded border border-slate-800">
                        <div className="font-bold text-slate-300">{config.timeout}ms</div>
                        <div>Timeout</div>
                     </div>
                  </div>
              </div>
            </div>

            {/* AI Analysis Section */}
            <div className="bg-gradient-to-br from-slate-900 to-slate-800 rounded-lg p-4 border border-slate-700 relative overflow-hidden flex flex-col">
              <div className="flex items-center justify-between mb-2">
                <h4 className="text-xs font-bold text-sky-400 uppercase flex items-center gap-2">
                  <Cpu size={14} /> AI Network Insight
                </h4>
                {!loadingAi && (
                  <button 
                    onClick={handleAiAnalyze}
                    className="text-xs bg-sky-600 hover:bg-sky-500 text-white px-2 py-1 rounded transition-colors"
                  >
                    Analyze
                  </button>
                )}
              </div>
              
              <div className="flex-1 overflow-y-auto pr-1">
                {loadingAi ? (
                  <div className="flex items-center justify-center h-24 text-sky-500 gap-2">
                     <div className="w-4 h-4 border-2 border-sky-500 border-t-transparent rounded-full animate-spin"></div>
                     <span className="text-xs">Analyzing last 60s of data...</span>
                  </div>
                ) : latestAnalysis ? (
                  <div className="space-y-4">
                    <div className="animate-in fade-in">
                      <p className="text-xs text-slate-500 mb-1 flex items-center gap-1">
                         Last Check: {formatDate(latestAnalysis.timestamp)}
                      </p>
                      <p className="text-sm text-slate-300 leading-relaxed">
                        {latestAnalysis.analysis}
                      </p>
                    </div>

                    {/* Previous Analysis History */}
                    {previousAnalyses.length > 0 && (
                      <div className="border-t border-slate-700/50 pt-2 mt-2">
                         <h5 className="text-[10px] uppercase text-slate-500 font-bold mb-2 flex items-center gap-1">
                           <History size={10} /> History
                         </h5>
                         <div className="space-y-2">
                            {previousAnalyses.map((entry, idx) => (
                              <div key={idx} className="text-xs text-slate-400 bg-slate-950/30 p-2 rounded">
                                <span className="block text-[10px] text-slate-600 mb-0.5">{formatDate(entry.timestamp)}</span>
                                <p className="line-clamp-2 hover:line-clamp-none transition-all">{entry.analysis}</p>
                              </div>
                            ))}
                         </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="h-full flex items-center justify-center text-center">
                    <p className="text-sm text-slate-500 italic">
                      Click analyze to get a breakdown of the connection quality using Gemini 2.5.
                    </p>
                  </div>
                )}
              </div>
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