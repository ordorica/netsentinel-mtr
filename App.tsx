import React, { useState, useEffect, useRef } from 'react';
import { ProbeStatus, Target, User, ProbeConfig } from './types';
import { runSimulationProbe } from './services/networkSimulator';
import { storage } from './services/storage';
import TargetCard from './components/TargetCard';
import AddTargetModal from './components/AddTargetModal';
import StatsSummary from './components/StatsSummary';
import BulkEditModal from './components/BulkEditModal';
import Auth from './components/Auth';
import TargetSettingsModal from './components/TargetSettingsModal';
import { Plus, Activity, Server, LogOut, User as UserIcon, Globe, FileText, LogIn } from 'lucide-react';

const App: React.FC = () => {
  const [user, setUser] = useState<User | null>(null);
  const [checkingSession, setCheckingSession] = useState(true);
  const [isPublicView, setIsPublicView] = useState(true); // Default to public view
  
  const [globalTargets, setGlobalTargets] = useState<Target[]>([]);
  const [userTargets, setUserTargets] = useState<Target[]>([]);
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isBulkEditOpen, setIsBulkEditOpen] = useState(false);
  const [globalStatus, setGlobalStatus] = useState<'Operational' | 'Degraded' | 'Outage'>('Operational');

  // Settings Modal State
  const [editingTarget, setEditingTarget] = useState<Target | null>(null);

  // Drag and Drop Refs
  const dragItem = useRef<number | null>(null);
  const dragOverItem = useRef<number | null>(null);

  // Check for existing session on mount
  useEffect(() => {
    const checkSession = async () => {
      try {
        const sessionUser = await storage.getCurrentSession();
        if (sessionUser) {
          setUser(sessionUser);
          setIsPublicView(false); // If logged in, exit public view (or just show dashboard)
        }
      } catch (e) {
        console.error("Session check failed", e);
      } finally {
        setCheckingSession(false);
      }
    };
    checkSession();
  }, []);

  // Load targets when user changes or view mode changes
  useEffect(() => {
    if (user) {
      setGlobalTargets(storage.getGlobalTargets());
      setUserTargets(storage.getUserTargets(user.id));
    } else if (isPublicView) {
      setGlobalTargets(storage.getGlobalTargets());
      setUserTargets([]);
    } else {
      setGlobalTargets([]);
      setUserTargets([]);
    }
  }, [user, isPublicView]);

  const refreshTargets = () => {
    if (user) {
      setGlobalTargets(storage.getGlobalTargets());
      setUserTargets(storage.getUserTargets(user.id));
    } else if (isPublicView) {
      setGlobalTargets(storage.getGlobalTargets());
    }
  };

  // Helper for simulation logic
  const processTargetSimulation = (target: Target): Target => {
    if (target.status !== ProbeStatus.Active) return target;

    // Use Custom Config or Default
    const probeConfig = target.probeConfig || { packetSize: 64, probeCount: 1, timeout: 1000 };
    
    // Simulate probe using config
    const result = runSimulationProbe(target.url, probeConfig);
    
    // Keep history manageable (last 50 points)
    const newHistory = [...target.history, result].slice(-50);
    
    // Simple Quality Score Calc
    let score = 100 - (result.packetLoss * 5) - (result.jitter * 0.5);
    if (result.latency > 200) score -= 20;
    score = Math.max(0, Math.min(100, Math.round(score)));

    // Uptime Calculation (Visual only)
    const isUp = result.packetLoss < 50;
    const newUptime = (target.uptimePercentage * 0.95) + ((isUp ? 100 : 0) * 0.05);

    // Cumulative Stats for 5 Nines (Simulated: packets = probes * count)
    const PACKETS_PER_PROBE = 100 * (probeConfig.probeCount || 1); 
    const packetsLost = Math.round(PACKETS_PER_PROBE * (result.packetLoss / 100));

    return {
      ...target,
      history: newHistory,
      currentQualityScore: score,
      uptimePercentage: newUptime,
      totalProbes: (target.totalProbes || 0) + 1,
      totalPacketsSent: (target.totalPacketsSent || 0) + PACKETS_PER_PROBE,
      totalPacketsLost: (target.totalPacketsLost || 0) + packetsLost,
      aiAnalysisHistory: target.aiAnalysisHistory || []
    };
  };

  // Probe Simulation Loop
  useEffect(() => {
    // Allow simulation if user is logged in OR if in public view
    if (!user && !isPublicView) return;

    const interval = setInterval(() => {
      // Always process Global Targets if we are viewing them
      setGlobalTargets(prev => {
        const updated = prev.map(processTargetSimulation);
        storage.saveTargets(updated); 
        return updated;
      });

      // Only process User Targets if logged in
      if (user) {
        setUserTargets(prev => {
          const updated = prev.map(processTargetSimulation);
          storage.saveTargets(updated);
          return updated;
        });
      }

    }, 2000); 

    return () => clearInterval(interval);
  }, [user, isPublicView]);

  // Global Status Calculation
  useEffect(() => {
    const allTargets = [...globalTargets, ...userTargets];
    if (allTargets.length === 0) {
      setGlobalStatus('Operational');
      return;
    }
    const avgScore = allTargets.reduce((acc, t) => acc + t.currentQualityScore, 0) / (allTargets.length || 1);
    if (avgScore < 50) setGlobalStatus('Outage');
    else if (avgScore < 85) setGlobalStatus('Degraded');
    else setGlobalStatus('Operational');
  }, [globalTargets, userTargets]);

  const handleAddTarget = (name: string, url: string, isGlobal: boolean, config: ProbeConfig, slaTarget: number) => {
    if (!user) return;

    const currentListCount = isGlobal ? globalTargets.length : userTargets.length;

    const newTarget: Target = {
      id: crypto.randomUUID(),
      userId: user.id,
      isGlobal: isGlobal,
      order: currentListCount, // Append to end
      name,
      url,
      status: ProbeStatus.Active,
      history: [],
      currentQualityScore: 100,
      uptimePercentage: 100,
      createdAt: Date.now(),
      totalProbes: 0,
      totalPacketsSent: 0,
      totalPacketsLost: 0,
      probeConfig: config,
      slaTarget: slaTarget,
      aiAnalysisHistory: []
    };
    
    storage.saveTargets([newTarget]);
    refreshTargets();
  };

  const handleUpdateConfig = (targetId: string, newConfig: ProbeConfig, newSlaTarget: number) => {
    // Find target in either list
    const all = [...globalTargets, ...userTargets];
    const target = all.find(t => t.id === targetId);
    
    if (target) {
        const updatedTarget = { 
          ...target, 
          probeConfig: newConfig,
          slaTarget: newSlaTarget
        };
        storage.saveTargets([updatedTarget]);
        refreshTargets();
    }
  };

  const handleAiAnalysisComplete = (targetId: string, analysisText: string) => {
    const all = [...globalTargets, ...userTargets];
    const target = all.find(t => t.id === targetId);
    
    if (target) {
      // Prepend new analysis to history
      const newEntry = {
        targetId,
        analysis: analysisText,
        timestamp: Date.now()
      };
      
      const updatedHistory = [newEntry, ...(target.aiAnalysisHistory || [])].slice(0, 5); // Keep last 5
      const updatedTarget = { ...target, aiAnalysisHistory: updatedHistory };
      
      storage.saveTargets([updatedTarget]);
      refreshTargets();
    }
  };

  const handleBulkUpdate = (parsedTargets: {name: string, url: string}[]) => {
    if (!user) return;

    // Use explicit loop to create map to avoid TS inference issues
    const currentMap = new Map<string, Target>();
    userTargets.forEach(t => currentMap.set(t.url, t));

    const newTargetsList: Target[] = [];
    const processedUrls = new Set<string>();

    parsedTargets.forEach((pt, index) => {
      processedUrls.add(pt.url);
      const existing = currentMap.get(pt.url);
      
      if (existing) {
        newTargetsList.push({
          ...existing,
          name: pt.name,
          order: index // Update order based on file order
        });
      } else {
        newTargetsList.push({
          id: crypto.randomUUID(),
          userId: user.id,
          isGlobal: false,
          order: index, // New item order
          name: pt.name,
          url: pt.url,
          status: ProbeStatus.Active,
          history: [],
          currentQualityScore: 100,
          uptimePercentage: 100,
          createdAt: Date.now(),
          totalProbes: 0,
          totalPacketsSent: 0,
          totalPacketsLost: 0,
          probeConfig: { packetSize: 64, probeCount: 1, timeout: 1000 },
          slaTarget: 99.999, // Default SLA for bulk items
          aiAnalysisHistory: []
        });
      }
    });

    const toDelete = userTargets.filter(t => !processedUrls.has(t.url));
    toDelete.forEach(t => storage.deleteTarget(t.id));
    
    storage.saveTargets(newTargetsList);
    refreshTargets();
  };

  const handleDeleteTarget = (id: string) => {
    if (!user) return;
    storage.deleteTarget(id);
    refreshTargets();
  };

  const handleLogout = () => {
    storage.logout();
    setUser(null);
    setIsPublicView(true); // Revert to public view on logout
    setGlobalTargets(storage.getGlobalTargets()); // Reset to just global
    setUserTargets([]);
  };

  // --- Drag and Drop Handlers ---

  const onDragStart = (e: React.DragEvent, index: number) => {
    dragItem.current = index;
    // Firefox requires dataTransfer to be set for dragging to work
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/html", e.currentTarget.innerHTML);
    e.dataTransfer.setDragImage(e.currentTarget as Element, 20, 20);
  };

  const onDragEnter = (e: React.DragEvent, index: number) => {
    dragOverItem.current = index;
    e.preventDefault();
  };

  const onDragEnd = (listType: 'global' | 'user') => {
    const dragIndex = dragItem.current;
    const dragOverIndex = dragOverItem.current;

    if (dragIndex === null || dragOverIndex === null || dragIndex === dragOverIndex) {
      dragItem.current = null;
      dragOverItem.current = null;
      return;
    }

    const list = listType === 'global' ? globalTargets : userTargets;
    const items = [...list];
    
    // Remove dragged item
    const draggedItemContent = items[dragIndex];
    items.splice(dragIndex, 1);
    
    // Insert at new position
    items.splice(dragOverIndex, 0, draggedItemContent);

    // Update 'order' property for all items
    const reordered = items.map((item, index) => ({
      ...item,
      order: index
    }));

    // Update State
    if (listType === 'global') {
      setGlobalTargets(reordered);
    } else {
      setUserTargets(reordered);
    }

    // Persist to Storage
    storage.saveTargets(reordered);

    // Reset refs
    dragItem.current = null;
    dragOverItem.current = null;
  };


  // Loading Screen
  if (checkingSession) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-indigo-500"></div>
      </div>
    );
  }

  // Auth Screen (Show only if no user AND not in public view)
  if (!user && !isPublicView) {
    return <Auth onLogin={(u) => { setUser(u); setIsPublicView(false); }} onPublicView={() => setIsPublicView(true)} />;
  }

  // Dashboard (Rendered if User OR Public View)
  return (
    <div className="min-h-screen bg-slate-950 text-slate-200 font-sans selection:bg-indigo-500/30">
      
      {/* Header */}
      <header className="sticky top-0 z-40 bg-slate-950/80 backdrop-blur-md border-b border-slate-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-indigo-600 p-2 rounded-lg shadow-lg shadow-indigo-500/20">
              <Activity className="w-5 h-5 text-white" />
            </div>
            <h1 className="text-xl font-bold tracking-tight text-slate-100">
              NetSentinel <span className="text-indigo-400">MTR</span>
            </h1>
            {isPublicView && !user && (
               <span className="ml-2 px-2 py-0.5 rounded-full bg-slate-800 border border-slate-700 text-[10px] text-slate-400 uppercase tracking-wider font-bold">
                 Public Status
               </span>
            )}
          </div>
          
          <div className="flex items-center gap-4">
             <div className="hidden md:flex items-center gap-2 px-3 py-1 rounded-full bg-slate-900 border border-slate-800">
               <div className={`w-2 h-2 rounded-full ${globalStatus === 'Operational' ? 'bg-green-500' : globalStatus === 'Degraded' ? 'bg-yellow-500' : 'bg-red-500'} animate-pulse`} />
               <span className="text-xs font-medium text-slate-400">System: {globalStatus}</span>
             </div>
             
             <div className="h-6 w-px bg-slate-800 hidden md:block"></div>

             {user ? (
               <>
                <div className="flex items-center gap-2 text-sm text-slate-300 mr-2">
                    <div className={`p-1 rounded-full ${user.role === 'admin' ? 'bg-indigo-500/20 text-indigo-400' : 'bg-slate-800 text-slate-500'}`}>
                      <UserIcon size={14} />
                    </div>
                    <span className="hidden sm:inline">{user.name}</span>
                </div>

                <button 
                  onClick={handleLogout}
                  className="text-slate-400 hover:text-white transition-colors p-2 hover:bg-slate-800 rounded-lg"
                  title="Sign Out"
                >
                  <LogOut size={18} />
                </button>

                <div className="flex items-center gap-2 ml-2">
                    <button 
                      onClick={() => setIsBulkEditOpen(true)}
                      className="bg-slate-800 hover:bg-slate-700 text-slate-200 p-2 rounded-lg transition-all"
                      title="Bulk Edit via Text"
                    >
                      <FileText size={20} />
                    </button>
                    <button 
                      onClick={() => setIsModalOpen(true)}
                      className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium px-4 py-2 rounded-lg transition-all shadow-lg shadow-indigo-500/20"
                    >
                      <Plus size={16} />
                      <span className="hidden sm:inline">Add Target</span>
                    </button>
                </div>
               </>
             ) : (
               <button 
                 onClick={() => setIsPublicView(false)}
                 className="flex items-center gap-2 text-indigo-400 hover:text-white transition-colors text-sm font-medium"
               >
                 <LogIn size={16} />
                 Sign In
               </button>
             )}
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        
        {/* Global List Section */}
        <div className="mb-12">
            <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-slate-100 flex items-center gap-2">
                    <Globe className="text-indigo-400" size={20}/>
                    Global Infrastructure
                </h2>
            </div>
            
            <StatsSummary targets={globalTargets} type="Global" />

            <div className="space-y-4">
                {globalTargets.map((target, index) => (
                    <TargetCard 
                        key={target.id} 
                        target={target} 
                        onDelete={handleDeleteTarget}
                        onEditConfig={(t) => setEditingTarget(t)}
                        onAnalyzeComplete={handleAiAnalysisComplete}
                        // Draggable if admin
                        draggable={user?.role === 'admin'}
                        onDragStart={(e) => onDragStart(e, index)}
                        onDragEnter={(e) => onDragEnter(e, index)}
                        onDragEnd={() => onDragEnd('global')}
                        // Read only logic
                        isReadOnly={!user || user.role !== 'admin'}
                    />
                ))}
                {globalTargets.length === 0 && (
                   <div className="p-8 bg-slate-900/30 border border-slate-800 border-dashed rounded-xl text-center text-slate-500">
                     No global targets configured.
                   </div>
                )}
            </div>
        </div>

        {/* User List Section - Only show if logged in */}
        {user && (
          <>
            <div className="h-px bg-gradient-to-r from-transparent via-slate-800 to-transparent my-12"></div>

            <div className="mb-10">
                <h2 className="text-lg font-semibold text-slate-100 mb-4 flex items-center gap-2">
                    <Server className="text-emerald-400" size={20}/>
                    My Targets
                </h2>
                
                <StatsSummary targets={userTargets} type="Personal" />

                <div className="space-y-4">
                {userTargets.map((target, index) => (
                    <TargetCard 
                      key={target.id} 
                      target={target} 
                      onDelete={handleDeleteTarget}
                      onEditConfig={(t) => setEditingTarget(t)}
                      onAnalyzeComplete={handleAiAnalysisComplete}
                      draggable={true}
                      onDragStart={(e) => onDragStart(e, index)}
                      onDragEnter={(e) => onDragEnter(e, index)}
                      onDragEnd={() => onDragEnd('user')}
                    />
                ))}
                
                {userTargets.length === 0 && (
                    <div className="text-center py-10 border-2 border-dashed border-slate-800 rounded-xl bg-slate-900/30">
                    <Server className="mx-auto h-10 w-10 text-slate-600 mb-4" />
                    <p className="text-slate-400 font-medium">No personal targets configured</p>
                    <button 
                        onClick={() => setIsModalOpen(true)}
                        className="mt-4 inline-flex items-center gap-2 text-indigo-400 hover:text-indigo-300 text-sm font-medium"
                    >
                        <Plus size={16} />
                        Add your first target
                    </button>
                    </div>
                )}
                </div>
            </div>
          </>
        )}

        <div className="mt-8 text-center">
           <p className="text-xs text-slate-600">
             * Note: Due to browser security restrictions (sandbox), this tool uses 
             simulated MTR data for demonstration purposes.
           </p>
        </div>
      </main>

      {user && (
        <>
          <AddTargetModal 
            isOpen={isModalOpen} 
            onClose={() => setIsModalOpen(false)} 
            onAdd={handleAddTarget}
            isAdmin={user.role === 'admin'}
          />

          <TargetSettingsModal 
            isOpen={!!editingTarget}
            onClose={() => setEditingTarget(null)}
            target={editingTarget}
            onSave={handleUpdateConfig}
          />

          <BulkEditModal
            isOpen={isBulkEditOpen}
            onClose={() => setIsBulkEditOpen(false)}
            targets={userTargets}
            onSave={handleBulkUpdate}
          />
        </>
      )}
    </div>
  );
};

export default App;