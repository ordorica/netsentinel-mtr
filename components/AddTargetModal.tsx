import React, { useState } from 'react';
import { X, Shield } from 'lucide-react';

interface AddTargetModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAdd: (name: string, url: string, isGlobal: boolean) => void;
  isAdmin: boolean;
}

const AddTargetModal: React.FC<AddTargetModalProps> = ({ isOpen, onClose, onAdd, isAdmin }) => {
  const [name, setName] = useState('');
  const [url, setUrl] = useState('');
  const [isGlobal, setIsGlobal] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if(name && url) {
      onAdd(name, url, isGlobal);
      setName('');
      setUrl('');
      setIsGlobal(false);
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
      <div className="bg-slate-900 border border-slate-800 rounded-xl w-full max-w-md p-6 shadow-2xl transform transition-all scale-100">
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