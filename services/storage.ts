import { User, StoredPlaylist, PlaylistSource } from '../types';

const USERS_KEY = 'streamflow_users';
const PLAYLISTS_KEY = 'streamflow_playlists_v2'; // Changed key to avoid conflict with old format
const SESSION_KEY = 'streamflow_session';

// Initialize default admin if not exists
const initStorage = () => {
  const users = localStorage.getItem(USERS_KEY);
  if (!users) {
    const defaultAdmin: User = {
      id: 'admin-1',
      username: 'admin',
      password: '123',
      role: 'admin'
    };
    localStorage.setItem(USERS_KEY, JSON.stringify([defaultAdmin]));
  }
};

initStorage();

export const storageService = {
  // --- Auth ---
  login: (username: string, password: string): User | null => {
    const users: User[] = JSON.parse(localStorage.getItem(USERS_KEY) || '[]');
    const user = users.find(u => u.username === username && u.password === password);
    if (user) {
      localStorage.setItem(SESSION_KEY, JSON.stringify(user));
      return user;
    }
    return null;
  },

  logout: () => {
    localStorage.removeItem(SESSION_KEY);
  },

  getCurrentUser: (): User | null => {
    const session = localStorage.getItem(SESSION_KEY);
    return session ? JSON.parse(session) : null;
  },

  // --- Users ---
  getUsers: (): User[] => {
    return JSON.parse(localStorage.getItem(USERS_KEY) || '[]');
  },

  addUser: (user: Omit<User, 'id'>) => {
    const users = storageService.getUsers();
    if (users.find(u => u.username === user.username)) {
      throw new Error('Username already exists');
    }
    const newUser: User = { ...user, id: crypto.randomUUID() };
    users.push(newUser);
    localStorage.setItem(USERS_KEY, JSON.stringify(users));
    return newUser;
  },

  updateUserPassword: (userId: string, newPassword: string) => {
    const users = storageService.getUsers();
    const userIndex = users.findIndex(u => u.id === userId);
    
    if (userIndex === -1) {
        throw new Error('User not found');
    }

    users[userIndex].password = newPassword;
    localStorage.setItem(USERS_KEY, JSON.stringify(users));

    // If the updated user is the currently logged in user, update session
    const currentUser = storageService.getCurrentUser();
    if (currentUser && currentUser.id === userId) {
        currentUser.password = newPassword;
        localStorage.setItem(SESSION_KEY, JSON.stringify(currentUser));
    }
  },

  deleteUser: (id: string) => {
    let users = storageService.getUsers();
    // Prevent deleting the last admin
    const userToDelete = users.find(u => u.id === id);
    if (userToDelete?.role === 'admin' && users.filter(u => u.role === 'admin').length <= 1) {
      throw new Error('Cannot delete the last admin');
    }
    users = users.filter(u => u.id !== id);
    localStorage.setItem(USERS_KEY, JSON.stringify(users));
  },

  // --- Playlists (Collections) ---
  getPlaylists: (): StoredPlaylist[] => {
    return JSON.parse(localStorage.getItem(PLAYLISTS_KEY) || '[]');
  },

  createPlaylist: (name: string) => {
    const playlists = storageService.getPlaylists();
    if (playlists.find(p => p.name === name)) {
        throw new Error("A playlist with this name already exists");
    }
    const newPlaylist: StoredPlaylist = {
        id: crypto.randomUUID(),
        name,
        sources: []
    };
    playlists.push(newPlaylist);
    localStorage.setItem(PLAYLISTS_KEY, JSON.stringify(playlists));
    return newPlaylist;
  },

  deletePlaylist: (id: string) => {
    let playlists = storageService.getPlaylists();
    playlists = playlists.filter(p => p.id !== id);
    localStorage.setItem(PLAYLISTS_KEY, JSON.stringify(playlists));
  },

  // --- Sources within Playlists ---
  addSourceToPlaylist: (playlistId: string, source: Omit<PlaylistSource, 'id' | 'addedAt'>) => {
      const playlists = storageService.getPlaylists();
      const playlistIndex = playlists.findIndex(p => p.id === playlistId);
      
      if (playlistIndex === -1) throw new Error("Playlist not found");

      const newSource: PlaylistSource = {
          ...source,
          id: crypto.randomUUID(),
          addedAt: Date.now()
      };

      playlists[playlistIndex].sources.push(newSource);

      try {
        localStorage.setItem(PLAYLISTS_KEY, JSON.stringify(playlists));
      } catch (e) {
        throw new Error('Storage quota exceeded. The playlist file is too large.');
      }
  },

  removeSourceFromPlaylist: (playlistId: string, sourceId: string) => {
      const playlists = storageService.getPlaylists();
      const playlistIndex = playlists.findIndex(p => p.id === playlistId);
      
      if (playlistIndex === -1) return;

      playlists[playlistIndex].sources = playlists[playlistIndex].sources.filter(s => s.id !== sourceId);
      localStorage.setItem(PLAYLISTS_KEY, JSON.stringify(playlists));
  },

  // --- Sync / Backup ---
  exportData: (): string => {
    const users = storageService.getUsers();
    const playlists = storageService.getPlaylists();
    return JSON.stringify({ 
      version: 1,
      timestamp: Date.now(),
      users, 
      playlists 
    });
  },

  importData: (jsonString: string) => {
    try {
      const data = JSON.parse(jsonString);
      
      // Basic validation
      if (!Array.isArray(data.users) || !Array.isArray(data.playlists)) {
        throw new Error('Invalid backup file: Missing users or playlists data.');
      }

      // Check format of users
      const validUsers = data.users.every((u: any) => u.id && u.username && u.role);
      if (!validUsers) throw new Error('Invalid backup file: User data corrupted.');

      localStorage.setItem(USERS_KEY, JSON.stringify(data.users));
      localStorage.setItem(PLAYLISTS_KEY, JSON.stringify(data.playlists));
      
      // Clear session to force re-login with new data
      localStorage.removeItem(SESSION_KEY);
      
      return true;
    } catch (e: any) {
      throw new Error(e.message || 'Failed to parse backup file');
    }
  }
};