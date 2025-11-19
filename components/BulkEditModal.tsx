import React, { useState, useEffect } from 'react';
import { X, Save, FileText, AlertCircle } from 'lucide-react';
import { Target } from '../types';

interface BulkEditModalProps {
  isOpen: boolean;
  onClose: () => void;
  targets: Target[];
  onSave: (newTargets: { name: string; url: string }[]) => void;
}

const BulkEditModal: React.FC<BulkEditModalProps> = ({ isOpen, onClose, targets, onSave }) => {
  const [text, setText] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (isOpen) {
      // Convert targets to CSV format: Name, URL
      const formatted = targets.map(t => `${t.name}, ${t.url}`).join('\n');
      setText(formatted);
      setError('');
    }
  }, [isOpen, targets]);

  if (!isOpen) return null;

  const handleSave = () => {
    const lines = text.split('\n').filter(line => line.trim().length > 0);
    const parsed: { name: string; url: string }[] = [];
    let hasError = false;

    lines.forEach((line, index) => {
      const parts = line.split(',').map(p => p.trim());
      if (parts.length < 2) {
        setError(`Line ${index + 1} is invalid. Format must be: Name, URL/IP`);
        hasError = true;
        return;
      }
      parsed.push({ name: parts[0], url: parts[1] });
    });

    if (!hasError) {
      onSave(parsed);
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
      <div className="bg-slate-900 border border-slate-800 rounded-xl w-full max-w-2xl p-6 shadow-2xl flex flex-col max-h-[90vh]">
        <div className="flex justify-between items-center mb-4">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-indigo-500/10 rounded-lg">
              <FileText className="text-indigo-400" size={20} />
            </div>
            <div>
               <h2 className="text-xl font-semibold text-white">Bulk Edit Targets</h2>
               <p className="text-xs text-slate-400">Edit your target list as plain text.</p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors">
            <X size={24} />
          </button>
        </div>

        <div className="bg-slate-950 rounded-lg p-4 border border-slate-800 mb-4">
          <p className="text-sm text-slate-400 font-mono">
            Format: <span className="text-indigo-400">Display Name</span>, <span className="text-emerald-400">Hostname or IP</span>
          </p>
        </div>
        
        <div className="flex-1 min-h-[300px] relative">
            <textarea 
              value={text}
              onChange={(e) => setText(e.target.value)}
              className="w-full h-full bg-slate-950 border border-slate-800 rounded-lg p-4 text-sm font-mono text-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent resize-none leading-relaxed"
              placeholder="My Server, 192.168.1.10&#10;Google DNS, 8.8.8.8"
              spellCheck={false}
            />
        </div>

        {error && (
          <div className="mt-4 flex items-center gap-2 text-red-400 text-sm bg-red-500/10 p-3 rounded-lg border border-red-500/20">
            <AlertCircle size={16} />
            {error}
          </div>
        )}
        
        <div className="mt-6 flex justify-end gap-3">
          <button 
            onClick={onClose}
            className="px-4 py-2 text-slate-300 hover:text-white font-medium transition-colors"
          >
            Cancel
          </button>
          <button 
            onClick={handleSave}
            className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white font-medium py-2 px-6 rounded-lg transition-colors shadow-lg shadow-indigo-500/20"
          >
            <Save size={18} />
            Save Changes
          </button>
        </div>
      </div>
    </div>
  );
};

export default BulkEditModal;