import React, { useState } from 'react';
import { X, Shield, Settings, HelpCircle } from 'lucide-react';
import { ProbeConfig } from '../types';

interface AddTargetModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAdd: (name: string, url: string, isGlobal: boolean, config: ProbeConfig, slaTarget: number) => void;
  isAdmin: boolean;
}

const AddTargetModal: React.FC<AddTargetModalProps> = ({ isOpen, onClose, onAdd, isAdmin }) => {
  const [name, setName] = useState('');
  const [url, setUrl] = useState('');
  const [isGlobal, setIsGlobal] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  
  // Config States
  const [packetSize, setPacketSize] = useState(64);
  const [probeCount, setProbeCount] = useState(1);
  const [timeout, setTimeout] = useState(1000);
  const [slaTarget, setSlaTarget] = useState(99.999);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if(name && url) {
      onAdd(name, url, isGlobal, {
        packetSize,
        probeCount,
        timeout
      }, slaTarget);
      // Reset form
      setName('');
      setUrl('');
      setIsGlobal(false);
      setShowAdvanced(false);
      setPacketSize(64);
      setProbeCount(1);
      setTimeout(1000);
      setSlaTarget(99.999);
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
      <div className="bg-slate-900 border border-slate-800 rounded-xl w-full max-w-md p-6 shadow-2xl transform transition-all scale-100 max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-semibold text-white">Monitor New Target</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-white">
            <X size={24} />
          </button>
        </div>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-400 mb-1">Display Name</label>
            <input 
              type="text" 
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Production Server"
              className="w-full bg-slate-950 border border-slate-800 rounded-lg px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-400 mb-1">Hostname / IP</label>
            <input 
              type="text" 
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="e.g. api.myservice.com"
              className="w-full bg-slate-950 border border-slate-800 rounded-lg px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          {isAdmin && (
             <div className="flex items-center gap-2 bg-indigo-500/10 p-3 rounded-lg border border-indigo-500/20">
               <input 
                 type="checkbox"
                 id="globalCheck"
                 checked={isGlobal}
                 onChange={(e) => setIsGlobal(e.target.checked)}
                 className="w-4 h-4 rounded border-slate-700 text-indigo-600 focus:ring-indigo-500 bg-slate-900"
               />
               <label htmlFor="globalCheck" className="text-sm text-indigo-200 flex items-center gap-2 cursor-pointer select-none">
                 <Shield size={14} /> Add to Global List
               </label>
             </div>
          )}

          {/* Advanced Settings Toggle */}
          <div className="border-t border-slate-800 pt-4 mt-2">
            <button
              type="button"
              onClick={() => setShowAdvanced(!showAdvanced)}
              className="flex items-center gap-2 text-slate-400 hover:text-indigo-400 text-sm font-medium transition-colors"
            >
              <Settings size={14} />
              {showAdvanced ? 'Hide Advanced Settings' : 'Show Advanced Settings'}
            </button>

            {showAdvanced && (
              <div className="mt-4 space-y-4 bg-slate-950/50 p-4 rounded-lg border border-slate-800 animate-in slide-in-from-top-2">
                 {/* SLA Config */}
                 <div>
                   <label className="block text-xs font-medium text-slate-500 mb-1 flex items-center justify-between">
                     <span>Target SLA (%)</span>
                     <a href="https://www.splunk.com/en_us/blog/learn/five-nines-availability.html" target="_blank" rel="noopener noreferrer" className="text-indigo-500 hover:underline flex items-center gap-1">
                       <HelpCircle size={10} />
                       <span className="text-[10px]">What is this?</span>
                     </a>
                   </label>
                   <input 
                      type="number" 
                      min="0" max="100" step="0.001"
                      value={slaTarget}
                      onChange={(e) => setSlaTarget(Number(e.target.value))}
                      className="w-full bg-slate-900 border border-slate-800 rounded px-3 py-1.5 text-slate-200 text-sm focus:border-indigo-500 outline-none font-mono"
                   />
                </div>

                <div>
                   <label className="block text-xs font-medium text-slate-500 mb-1">Packet Size (Bytes)</label>
                   <input 
                      type="number" 
                      min="32" max="1500"
                      value={packetSize}
                      onChange={(e) => setPacketSize(Number(e.target.value))}
                      className="w-full bg-slate-900 border border-slate-800 rounded px-3 py-1.5 text-slate-200 text-sm focus:border-indigo-500 outline-none"
                   />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-slate-500 mb-1">Probes per Check</label>
                    <input 
                        type="number" 
                        min="1" max="10"
                        value={probeCount}
                        onChange={(e) => setProbeCount(Number(e.target.value))}
                        className="w-full bg-slate-900 border border-slate-800 rounded px-3 py-1.5 text-slate-200 text-sm focus:border-indigo-500 outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-500 mb-1">Timeout (ms)</label>
                    <input 
                        type="number" 
                        min="100" max="10000" step="100"
                        value={timeout}
                        onChange={(e) => setTimeout(Number(e.target.value))}
                        className="w-full bg-slate-900 border border-slate-800 rounded px-3 py-1.5 text-slate-200 text-sm focus:border-indigo-500 outline-none"
                    />
                  </div>
                </div>
              </div>
            )}
          </div>
          
          <div className="pt-4">
            <button 
              type="submit"
              className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-medium py-2 px-4 rounded-lg transition-colors shadow-lg shadow-indigo-500/20"
            >
              Start Monitoring
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AddTargetModal;