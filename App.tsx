import React, { useState, useEffect } from 'react';
import { ProbeStatus, Target, User } from './types';
import { runSimulationProbe } from './services/networkSimulator';
import { storage } from './services/storage';
import TargetCard from './components/TargetCard';
import AddTargetModal from './components/AddTargetModal';
import StatsSummary from './components/StatsSummary';
import BulkEditModal from './components/BulkEditModal';
import Auth from './components/Auth';
import { Plus, Activity, Server, LogOut, User as UserIcon, Globe, FileText } from 'lucide-react';

const App: React.FC = () => {
  const [user, setUser] = useState<User | null>(null);
  const [checkingSession, setCheckingSession] = useState(true);
  
  const [globalTargets, setGlobalTargets] = useState<Target[]>([]);
  const [userTargets, setUserTargets] = useState<Target[]>([]);
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isBulkEditOpen, setIsBulkEditOpen] = useState(false);
  const [globalStatus, setGlobalStatus] = useState<'Operational' | 'Degraded' | 'Outage'>('Operational');

  // Check for existing session on mount
  useEffect(() => {
    const checkSession = async () => {
      try {
        const sessionUser = await storage.getCurrentSession();
        if (sessionUser) {
          setUser(sessionUser);
        }
      } catch (e) {
        console.error("Session check failed", e);
      } finally {
        setCheckingSession(false);
      }
    };
    checkSession();
  }, []);

  // Load targets when user changes
  useEffect(() => {
    if (user) {
      refreshTargets();
    } else {
      setGlobalTargets([]);
      setUserTargets([]);
    }
  }, [user]);

  const refreshTargets = () => {
    if (!user) return;
    setGlobalTargets(storage.getGlobalTargets());
    setUserTargets(storage.getUserTargets(user.id));
  };

  // Helper for simulation logic
  const processTargetSimulation = (target: Target): Target => {
    if (target.status !== ProbeStatus.Active) return target;

    const result = runSimulationProbe(target.url);
    
    // Keep history manageable (last 50 points)
    const newHistory = [...target.history, result].slice(-50);
    
    // Simple Quality Score Calc
    let score = 100 - (result.packetLoss * 5) - (result.jitter * 0.5);
    if (result.latency > 200) score -= 20;
    score = Math.max(0, Math.min(100, Math.round(score)));

    // Uptime Calculation (Visual only)
    const isUp = result.packetLoss < 50;
    const newUptime = (target.uptimePercentage * 0.95) + ((isUp ? 100 : 0) * 0.05);

    // Cumulative Stats for 5 Nines (Simulated: each probe is ~100 packets)
    const PACKETS_PER_PROBE = 100; 
    const packetsLost = Math.round(PACKETS_PER_PROBE * (result.packetLoss / 100));

    return {
      ...target,
      history: newHistory,
      currentQualityScore: score,
      uptimePercentage: newUptime,
      totalProbes: (target.totalProbes || 0) + 1,
      totalPacketsSent: (target.totalPacketsSent || 0) + PACKETS_PER_PROBE,
      totalPacketsLost: (target.totalPacketsLost || 0) + packetsLost
    };
  };

  // Probe Simulation Loop
  useEffect(() => {
    if (!user) return;

    const interval = setInterval(() => {
      // Process Global Targets
      setGlobalTargets(prev => {
        const updated = prev.map(processTargetSimulation);
        storage.saveTargets(updated); 
        return updated;
      });

      // Process User Targets
      setUserTargets(prev => {
        const updated = prev.map(processTargetSimulation);
        storage.saveTargets(updated);
        return updated;
      });

    }, 2000); 

    return () => clearInterval(interval);
  }, [user]);

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

  const handleAddTarget = (name: string, url: string, isGlobal: boolean) => {
    if (!user) return;

    const newTarget: Target = {
      id: crypto.randomUUID(),
      userId: user.id,
      isGlobal: isGlobal,
      name,
      url,
      status: ProbeStatus.Active,
      history: [],
      currentQualityScore: 100,
      uptimePercentage: 100,
      createdAt: Date.now(),
      totalProbes: 0,
      totalPacketsSent: 0,
      totalPacketsLost: 0
    };
    
    storage.saveTargets([newTarget]);
    refreshTargets();
  };

  const handleBulkUpdate = (parsedTargets: {name: string, url: string}[]) => {
    if (!user) return;

    // Sync logic: 
    // 1. Identify targets to delete (present in userTargets but not in parsed)
    // 2. Identify targets to add (present in parsed but not in userTargets by URL)
    // 3. Identify targets to update (present in both)
    
    // Note: We are only bulk editing USER targets, not global.
    // Fix: Explicitly type the map entries as a tuple [string, Target] to ensure Map<string, Target> inference.
    const currentMap = new Map(userTargets.map(t => [t.url, t] as [string, Target]));
    const newTargetsList: Target[] = [];
    const processedUrls = new Set<string>();

    parsedTargets.forEach(pt => {
      processedUrls.add(pt.url);
      if (currentMap.has(pt.url)) {
        // Update existing (preserve history and ID)
        const existing = currentMap.get(pt.url)!;
        newTargetsList.push({
          ...existing,
          name: pt.name 
        });
      } else {
        // Create new
        newTargetsList.push({
          id: crypto.randomUUID(),
          userId: user.id,
          isGlobal: false,
          name: pt.name,
          url: pt.url,
          status: ProbeStatus.Active,
          history: [],
          currentQualityScore: 100,
          uptimePercentage: 100,
          createdAt: Date.now(),
          totalProbes: 0,
          totalPacketsSent: 0,
          totalPacketsLost: 0
        });
      }
    });

    // Delete targets that are in currentMap but not in processedUrls
    // We achieve this by simply not including them in newTargetsList and overwriting storage.
    // However, `storage.saveTargets` merges. `storage.deleteTarget` removes one by one.
    // To handle bulk replace correctly with the current simple storage service,
    // we should first delete the ones missing, then save the new list.
    
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
    setGlobalTargets([]);
    setUserTargets([]);
  };

  // Loading Screen
  if (checkingSession) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-indigo-500"></div>
      </div>
    );
  }

  // Auth Screen
  if (!user) {
    return <Auth onLogin={setUser} />;
  }

  // Dashboard
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
          </div>
          
          <div className="flex items-center gap-4">
             <div className="hidden md:flex items-center gap-2 px-3 py-1 rounded-full bg-slate-900 border border-slate-800">
               <div className={`w-2 h-2 rounded-full ${globalStatus === 'Operational' ? 'bg-green-500' : globalStatus === 'Degraded' ? 'bg-yellow-500' : 'bg-red-500'} animate-pulse`} />
               <span className="text-xs font-medium text-slate-400">System: {globalStatus}</span>
             </div>
             
             <div className="h-6 w-px bg-slate-800 hidden md:block"></div>

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
                {globalTargets.map(target => (
                    <TargetCard 
                        key={target.id} 
                        target={target} 
                        onDelete={handleDeleteTarget}
                        isReadOnly={user.role !== 'admin'}
                    />
                ))}
                {globalTargets.length === 0 && (
                   <div className="p-8 bg-slate-900/30 border border-slate-800 border-dashed rounded-xl text-center text-slate-500">
                     No global targets configured.
                   </div>
                )}
            </div>
        </div>

        {/* Divider */}
        <div className="h-px bg-gradient-to-r from-transparent via-slate-800 to-transparent my-12"></div>

        {/* User List Section */}
        <div className="mb-10">
             <h2 className="text-lg font-semibold text-slate-100 mb-4 flex items-center gap-2">
                <Server className="text-emerald-400" size={20}/>
                My Targets
            </h2>
            
            <StatsSummary targets={userTargets} type="Personal" />

            <div className="space-y-4">
            {userTargets.map(target => (
                <TargetCard 
                key={target.id} 
                target={target} 
                onDelete={handleDeleteTarget}
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

        <div className="mt-8 text-center">
           <p className="text-xs text-slate-600">
             * Note: Due to browser security restrictions (sandbox), this tool uses 
             simulated MTR data for demonstration purposes.
           </p>
        </div>
      </main>

      <AddTargetModal 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)} 
        onAdd={handleAddTarget}
        isAdmin={user.role === 'admin'}
      />

      <BulkEditModal
        isOpen={isBulkEditOpen}
        onClose={() => setIsBulkEditOpen(false)}
        targets={userTargets}
        onSave={handleBulkUpdate}
      />
    </div>
  );
};

export default App;