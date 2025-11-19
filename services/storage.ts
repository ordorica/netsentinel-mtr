import { User, Target, ProbeStatus } from '../types';

const USERS_KEY = 'ns_users';
const TARGETS_KEY = 'ns_targets';
const SESSION_KEY = 'ns_session';

const ADMIN_ID = 'admin-global-001';
const ADMIN_USERNAME = 'netsentinel';
const ADMIN_PASSWORD = 'InItNow!'; // In a real app, this would be hashed/salted properly

// Helper to simulate delay
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// Initial Seed Data
const GLOBAL_TARGETS_SEED: Target[] = [
  {
    id: 'global-google-dns',
    userId: ADMIN_ID,
    isGlobal: true,
    order: 0,
    name: 'Google DNS',
    url: '8.8.8.8',
    status: ProbeStatus.Active,
    history: [],
    currentQualityScore: 100,
    uptimePercentage: 100,
    createdAt: Date.now(),
    totalProbes: 0,
    totalPacketsSent: 0,
    totalPacketsLost: 0
  },
  {
    id: 'global-opendns',
    userId: ADMIN_ID,
    isGlobal: true,
    order: 1,
    name: 'OpenDNS',
    url: '208.67.222.222',
    status: ProbeStatus.Active,
    history: [],
    currentQualityScore: 100,
    uptimePercentage: 100,
    createdAt: Date.now(),
    totalProbes: 0,
    totalPacketsSent: 0,
    totalPacketsLost: 0
  },
  {
    id: 'global-cloudflare',
    userId: ADMIN_ID,
    isGlobal: true,
    order: 2,
    name: 'Cloudflare DNS',
    url: '1.1.1.1',
    status: ProbeStatus.Active,
    history: [],
    currentQualityScore: 100,
    uptimePercentage: 100,
    createdAt: Date.now(),
    totalProbes: 0,
    totalPacketsSent: 0,
    totalPacketsLost: 0
  },
  {
    id: 'global-quad9',
    userId: ADMIN_ID,
    isGlobal: true,
    order: 3,
    name: 'Quad9 DNS',
    url: '9.9.9.9',
    status: ProbeStatus.Active,
    history: [],
    currentQualityScore: 100,
    uptimePercentage: 100,
    createdAt: Date.now(),
    totalProbes: 0,
    totalPacketsSent: 0,
    totalPacketsLost: 0
  }
];

export const storage = {
  // --- Internal Helper to Seed Admin ---
  seedAdmin: () => {
    const users = storage.getUsers();
    const adminExists = users.find(u => u.id === ADMIN_ID);
    
    if (!adminExists) {
      const adminUser: User = {
        id: ADMIN_ID,
        name: 'NetSentinel Admin',
        email: ADMIN_USERNAME,
        passwordHash: btoa(ADMIN_PASSWORD),
        role: 'admin',
        createdAt: Date.now()
      };
      users.push(adminUser);
      localStorage.setItem(USERS_KEY, JSON.stringify(users));
    }

    // Seed Global Targets - Merge/Ensure existence
    const targets = storage.getAllTargets();
    let updatedTargets = [...targets];
    let changed = false;

    GLOBAL_TARGETS_SEED.forEach(seed => {
      const exists = updatedTargets.find(t => t.id === seed.id);
      if (!exists) {
        updatedTargets.push(seed);
        changed = true;
      }
    });

    if (changed) {
      localStorage.setItem(TARGETS_KEY, JSON.stringify(updatedTargets));
    }
  },

  // --- Auth Methods ---

  getUsers: (): User[] => {
    const users = localStorage.getItem(USERS_KEY);
    return users ? JSON.parse(users) : [];
  },

  saveUser: (user: User): void => {
    const users = storage.getUsers();
    users.push(user);
    localStorage.setItem(USERS_KEY, JSON.stringify(users));
  },

  login: async (identifier: string, password: string): Promise<User> => {
    storage.seedAdmin(); // Ensure admin exists before login check
    await delay(600); 
    
    const users = storage.getUsers();
    const user = users.find(u => 
      u.email.toLowerCase() === identifier.toLowerCase() && 
      u.passwordHash === btoa(password)
    );
    
    if (!user) {
      throw new Error('Invalid credentials');
    }
    
    localStorage.setItem(SESSION_KEY, user.id);
    return user;
  },

  signup: async (name: string, email: string, password: string): Promise<User> => {
    storage.seedAdmin();
    await delay(800); 
    
    const users = storage.getUsers();
    if (email.toLowerCase() === ADMIN_USERNAME.toLowerCase()) {
       throw new Error('Username reserved');
    }
    if (users.find(u => u.email.toLowerCase() === email.toLowerCase())) {
      throw new Error('User already exists');
    }

    const newUser: User = {
      id: crypto.randomUUID(),
      name,
      email,
      passwordHash: btoa(password),
      role: 'user',
      createdAt: Date.now()
    };

    storage.saveUser(newUser);
    
    // Initialize with examples for the new user
    const initialTargets: Target[] = [
      {
        id: crypto.randomUUID(),
        userId: newUser.id,
        isGlobal: false,
        order: 0,
        name: 'Local Gateway',
        url: '192.168.1.1',
        status: ProbeStatus.Active,
        history: [],
        currentQualityScore: 95,
        uptimePercentage: 99.9,
        createdAt: Date.now(),
        totalProbes: 0,
        totalPacketsSent: 0,
        totalPacketsLost: 0
      },
      {
        id: crypto.randomUUID(),
        userId: newUser.id,
        isGlobal: false,
        order: 1,
        name: 'Example Web',
        url: 'example.com',
        status: ProbeStatus.Active,
        history: [],
        currentQualityScore: 100,
        uptimePercentage: 100,
        createdAt: Date.now(),
        totalProbes: 0,
        totalPacketsSent: 0,
        totalPacketsLost: 0
      }
    ];
    
    storage.saveTargets(initialTargets);
    localStorage.setItem(SESSION_KEY, newUser.id);
    
    return newUser;
  },

  logout: () => {
    localStorage.removeItem(SESSION_KEY);
  },

  getCurrentSession: async (): Promise<User | null> => {
    // Ensure admin exists on reload
    storage.seedAdmin();
    const userId = localStorage.getItem(SESSION_KEY);
    if (!userId) return null;
    
    const users = storage.getUsers();
    return users.find(u => u.id === userId) || null;
  },

  // --- Data Methods ---

  getAllTargets: (): Target[] => {
    const targets = localStorage.getItem(TARGETS_KEY);
    return targets ? JSON.parse(targets) : [];
  },

  getGlobalTargets: (): Target[] => {
    const all = storage.getAllTargets();
    return all.filter(t => t.isGlobal).sort((a, b) => (a.order || 0) - (b.order || 0));
  },

  getUserTargets: (userId: string): Target[] => {
    const all = storage.getAllTargets();
    // Users see their own targets
    return all
      .filter(t => t.userId === userId && !t.isGlobal)
      .sort((a, b) => (a.order || 0) - (b.order || 0));
  },

  saveTargets: (targetsToSave: Target[]) => {
    const allTargets = storage.getAllTargets();
    const targetMap = new Map(allTargets.map(t => [t.id, t]));
    
    targetsToSave.forEach(t => {
      targetMap.set(t.id, t);
    });
    
    localStorage.setItem(TARGETS_KEY, JSON.stringify(Array.from(targetMap.values())));
  },

  deleteTarget: (targetId: string) => {
    const allTargets = storage.getAllTargets();
    const filtered = allTargets.filter(t => t.id !== targetId);
    localStorage.setItem(TARGETS_KEY, JSON.stringify(filtered));
  }
};