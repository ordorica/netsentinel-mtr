import React, { useState, useEffect } from 'react';
import { X, Save, Settings, Info, HelpCircle } from 'lucide-react';
import { Target, ProbeConfig } from '../types';

interface TargetSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  target: Target | null;
  onSave: (targetId: string, newConfig: ProbeConfig, newSlaTarget: number) => void;
}

const TargetSettingsModal: React.FC<TargetSettingsModalProps> = ({ isOpen, onClose, target, onSave }) => {
  const [packetSize, setPacketSize] = useState(64);
  const [probeCount, setProbeCount] = useState(1);
  const [timeout, setTimeout] = useState(1000);
  const [slaTarget, setSlaTarget] = useState(99.999);

  useEffect(() => {
    if (target && isOpen) {
      setPacketSize(target.probeConfig?.packetSize || 64);
      setProbeCount(target.probeConfig?.probeCount || 1);
      setTimeout(target.probeConfig?.timeout || 1000);
      setSlaTarget(target.slaTarget ?? 99.999);
    }
  }, [target, isOpen]);

  if (!isOpen || !target) return null;

  const handleSave = () => {
    onSave(target.id, {
      packetSize,
      probeCount,
      timeout
    }, slaTarget);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
      <div className="bg-slate-900 border border-slate-800 rounded-xl w-full max-w-md p-6 shadow-2xl">
        <div className="flex justify-between items-center mb-6">
          <div className="flex items-center gap-2 text-white">
            <div className="bg-slate-800 p-2 rounded-lg">
                <Settings size={20} className="text-indigo-400" />
            </div>
            <div>
                <h2 className="text-lg font-semibold">Probe Configuration</h2>
                <p className="text-xs text-slate-400 font-mono">{target.name}</p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white">
            <X size={24} />
          </button>
        </div>
        
        <div className="space-y-5">
            <div className="bg-blue-500/10 border border-blue-500/20 p-3 rounded-lg flex gap-3">
                <Info className="text-blue-400 shrink-0 mt-0.5" size={16} />
                <p className="text-xs text-blue-200 leading-relaxed">
                    Adjusting these settings will impact how probes are sent and how metrics are calculated. 
                </p>
            </div>

             {/* SLA Config */}
             <div>
                <label className="flex justify-between text-sm font-medium text-slate-300 mb-2">
                     <span>Target SLA (%)</span>
                     <a href="https://www.splunk.com/en_us/blog/learn/five-nines-availability.html" target="_blank" rel="noopener noreferrer" className="text-indigo-500 hover:underline flex items-center gap-1">
                       <HelpCircle size={10} />
                       <span className="text-[10px]">Info</span>
                     </a>
                </label>
                <input 
                    type="number" 
                    min="0" max="100" step="0.001"
                    value={slaTarget}
                    onChange={(e) => setSlaTarget(Number(e.target.value))}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-slate-200 text-sm focus:border-indigo-500 outline-none focus:ring-1 focus:ring-indigo-500 font-mono"
                />
            </div>

            <div className="border-t border-slate-800 pt-4">
                <label className="flex justify-between text-sm font-medium text-slate-300 mb-2">
                    Packet Size
                    <span className="text-slate-500 font-normal">{packetSize} bytes</span>
                </label>
                <input 
                    type="range" 
                    min="32" max="1500" step="16"
                    value={packetSize}
                    onChange={(e) => setPacketSize(Number(e.target.value))}
                    className="w-full h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-indigo-500"
                />
                <div className="flex justify-between text-[10px] text-slate-600 mt-1 font-mono">
                    <span>32B</span>
                    <span>1500B</span>
                </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
                <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">Probes per Check</label>
                <input 
                    type="number" 
                    min="1" max="10"
                    value={probeCount}
                    onChange={(e) => setProbeCount(Number(e.target.value))}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-slate-200 text-sm focus:border-indigo-500 outline-none focus:ring-1 focus:ring-indigo-500"
                />
                </div>
                <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">Timeout Limit (ms)</label>
                <input 
                    type="number" 
                    min="100" max="10000" step="100"
                    value={timeout}
                    onChange={(e) => setTimeout(Number(e.target.value))}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-slate-200 text-sm focus:border-indigo-500 outline-none focus:ring-1 focus:ring-indigo-500"
                />
                </div>
            </div>
        </div>
          
        <div className="pt-6 mt-2 flex justify-end gap-3">
            <button 
                onClick={onClose}
                className="px-4 py-2 text-sm font-medium text-slate-400 hover:text-white transition-colors"
            >
                Cancel
            </button>
            <button 
                onClick={handleSave}
                className="bg-indigo-600 hover:bg-indigo-500 text-white font-medium py-2 px-4 rounded-lg transition-colors shadow-lg shadow-indigo-500/20 flex items-center gap-2 text-sm"
            >
                <Save size={16} />
                Save Configuration
            </button>
        </div>
      </div>
    </div>
  );
};

export default TargetSettingsModal;