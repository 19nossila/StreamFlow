import React, { useState, useEffect } from 'react';
import { storageService } from '../services/storage';
import { User, StoredPlaylist } from '../types';

interface AdminDashboardProps {
  onLogout: () => void;
  onPreview: (playlist: StoredPlaylist) => void;
}

const AdminDashboard: React.FC<AdminDashboardProps> = ({ onLogout, onPreview }) => {
  const [activeTab, setActiveTab] = useState<'users' | 'playlists' | 'settings'>('playlists');
  
  // Data State
  const [users, setUsers] = useState<User[]>([]);
  const [playlists, setPlaylists] = useState<StoredPlaylist[]>([]);
  
  // UI State for Playlists
  const [editingPlaylistId, setEditingPlaylistId] = useState<string | null>(null);

  // Forms State
  const [newUser, setNewUser] = useState({ username: '', password: '' });
  const [newPlaylistName, setNewPlaylistName] = useState('');
  
  // Settings State
  const [passwords, setPasswords] = useState({ new: '', confirm: '' });
  
  // Source Forms
  const [sourceUrls, setSourceUrls] = useState('');
  const [uploadLoading, setUploadLoading] = useState(false);
  
  // Notifications
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = () => {
    setUsers(storageService.getUsers());
    setPlaylists(storageService.getPlaylists());
  };

  const clearMessages = () => {
      setError(null);
      setSuccessMsg(null);
  };

  // --- User Management ---
  const handleAddUser = (e: React.FormEvent) => {
    e.preventDefault();
    try {
      storageService.addUser({ ...newUser, role: 'user' });
      setNewUser({ username: '', password: '' });
      loadData();
      clearMessages();
      setSuccessMsg('User added successfully');
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleDeleteUser = (id: string) => {
    if (confirm('Are you sure?')) {
      try {
        storageService.deleteUser(id);
        loadData();
        clearMessages();
      } catch (err: any) {
        setError(err.message);
      }
    }
  };

  // --- Settings / Password Management ---
  const handleUpdatePassword = (e: React.FormEvent) => {
      e.preventDefault();
      clearMessages();
      
      if (passwords.new !== passwords.confirm) {
          setError("Passwords do not match.");
          return;
      }
      if (passwords.new.length < 3) {
          setError("Password must be at least 3 characters long.");
          return;
      }

      try {
          const currentUser = storageService.getCurrentUser();
          if (!currentUser) throw new Error("Not logged in");
          
          storageService.updateUserPassword(currentUser.id, passwords.new);
          setPasswords({ new: '', confirm: '' });
          setSuccessMsg("Password updated successfully.");
      } catch (err: any) {
          setError(err.message);
      }
  };

  // --- Backup / Restore ---
  const handleExportBackup = () => {
      try {
        const data = storageService.exportData();
        const blob = new Blob([data], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `streamflow_backup_${new Date().toISOString().slice(0,10)}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        setSuccessMsg("Configuration exported successfully. Send this file to your other device.");
      } catch (err: any) {
        setError("Export failed: " + err.message);
      }
  };

  const handleImportBackup = (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      if (!confirm("WARNING: importing a backup will REPLACE all current playlists and users on this device. Continue?")) {
          e.target.value = ''; // Reset input
          return;
      }

      const reader = new FileReader();
      reader.onload = (event) => {
          try {
              const content = event.target?.result as string;
              storageService.importData(content);
              alert("Import successful! The page will now reload.");
              window.location.reload();
          } catch (err: any) {
              setError("Import failed: " + err.message);
          }
      };
      reader.readAsText(file);
  };

  // --- Playlist (Collection) Management ---
  const handleCreatePlaylist = (e: React.FormEvent) => {
      e.preventDefault();
      try {
          if (!newPlaylistName.trim()) return;
          const newPl = storageService.createPlaylist(newPlaylistName);
          setNewPlaylistName('');
          loadData();
          setEditingPlaylistId(newPl.id); // Auto enter edit mode
          clearMessages();
          setSuccessMsg(`Created playlist "${newPl.name}"`);
      } catch (err: any) {
          setError(err.message);
      }
  };

  const handleDeletePlaylist = (id: string) => {
      if (confirm('Delete this entire playlist and all its sources?')) {
          storageService.deletePlaylist(id);
          if (editingPlaylistId === id) setEditingPlaylistId(null);
          loadData();
      }
  };

  // --- Source Management (Inside a Playlist) ---
  const handleAddUrls = async (playlistId: string) => {
      setUploadLoading(true);
      clearMessages();

      const urls = sourceUrls.split('\n').map(u => u.trim()).filter(u => u.length > 0);
      if (urls.length === 0) {
          setError("No URLs provided");
          setUploadLoading(false);
          return;
      }

      let success = 0;
      let fail = 0;

      try {
          for (const url of urls) {
              try {
                  const res = await fetch(url);
                  if (!res.ok) throw new Error("Fetch failed");
                  const content = await res.text();
                  
                  storageService.addSourceToPlaylist(playlistId, {
                      type: 'url',
                      content,
                      identifier: url
                  });
                  success++;
              } catch (e) {
                  console.error(e);
                  fail++;
              }
          }
          
          setSourceUrls('');
          loadData();
          
          if (fail > 0) setError(`Added ${success} URLs. Failed to add ${fail}.`);
          else setSuccessMsg(`Successfully added ${success} URLs.`);

      } catch (e: any) {
          setError(e.message);
      } finally {
          setUploadLoading(false);
      }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>, playlistId: string) => {
      const files = e.target.files;
      if (!files || files.length === 0) return;

      setUploadLoading(true);
      clearMessages();
      
      let processed = 0;
      const total = files.length;

      Array.from(files).forEach((file: any) => {
          const reader = new FileReader();
          reader.onload = (event) => {
              try {
                  const content = event.target?.result as string;
                  storageService.addSourceToPlaylist(playlistId, {
                      type: 'file',
                      content,
                      identifier: file.name
                  });
              } catch (e) {
                  console.error(e);
              } finally {
                  processed++;
                  if (processed === total) {
                      loadData();
                      setUploadLoading(false);
                      setSuccessMsg(`Uploaded ${total} files.`);
                  }
              }
          };
          reader.readAsText(file);
      });
  };

  const handleRemoveSource = (playlistId: string, sourceId: string) => {
      if (confirm("Remove this source?")) {
          storageService.removeSourceFromPlaylist(playlistId, sourceId);
          loadData();
      }
  };

  const activePlaylist = playlists.find(p => p.id === editingPlaylistId);

  return (
    <div className="min-h-screen bg-gray-900 text-white flex flex-col">
      <header className="bg-gray-800 border-b border-gray-700 p-4 flex justify-between items-center shadow-md">
        <h1 className="text-xl font-bold text-red-500"><i className="fas fa-cogs mr-2"></i>Admin Dashboard</h1>
        <button onClick={onLogout} className="text-gray-300 hover:text-white"><i className="fas fa-sign-out-alt mr-1"></i> Logout</button>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        <aside className="w-64 bg-gray-800 p-4 hidden md:block border-r border-gray-700">
          <nav className="space-y-2">
            <button
              onClick={() => { setActiveTab('playlists'); setEditingPlaylistId(null); }}
              className={`w-full text-left px-4 py-3 rounded transition-colors ${activeTab === 'playlists' ? 'bg-red-600 text-white shadow' : 'text-gray-400 hover:bg-gray-700'}`}
            >
              <i className="fas fa-list mr-2"></i> Playlists
            </button>
            <button
              onClick={() => setActiveTab('users')}
              className={`w-full text-left px-4 py-3 rounded transition-colors ${activeTab === 'users' ? 'bg-red-600 text-white shadow' : 'text-gray-400 hover:bg-gray-700'}`}
            >
              <i className="fas fa-users mr-2"></i> Users
            </button>
            <button
              onClick={() => setActiveTab('settings')}
              className={`w-full text-left px-4 py-3 rounded transition-colors ${activeTab === 'settings' ? 'bg-red-600 text-white shadow' : 'text-gray-400 hover:bg-gray-700'}`}
            >
              <i className="fas fa-lock mr-2"></i> Settings
            </button>
          </nav>
        </aside>

        <main className="flex-1 p-6 overflow-y-auto">
          {error && (
            <div className="bg-red-900/50 border border-red-500 text-red-200 p-4 rounded mb-6 flex justify-between items-center animate-pulse">
              <span>{error}</span>
              <button onClick={() => setError(null)}><i className="fas fa-times"></i></button>
            </div>
          )}
          
          {successMsg && (
            <div className="bg-green-900/50 border border-green-500 text-green-200 p-4 rounded mb-6 flex justify-between items-center">
              <span>{successMsg}</span>
              <button onClick={() => setSuccessMsg(null)}><i className="fas fa-times"></i></button>
            </div>
          )}

          {/* === USERS TAB === */}
          {activeTab === 'users' && (
            <div className="max-w-4xl mx-auto">
              <div className="bg-gray-800 rounded-lg p-6 mb-6 border border-gray-700">
                <h3 className="text-lg font-bold mb-4">Add New User</h3>
                <form onSubmit={handleAddUser} className="flex gap-4 items-end">
                  <div className="flex-1">
                    <label className="text-xs text-gray-500 uppercase">Username</label>
                    <input required value={newUser.username} onChange={e => setNewUser({ ...newUser, username: e.target.value })} className="w-full bg-gray-900 border border-gray-600 rounded p-2 text-white" />
                  </div>
                  <div className="flex-1">
                    <label className="text-xs text-gray-500 uppercase">Password</label>
                    <input required type="password" value={newUser.password} onChange={e => setNewUser({ ...newUser, password: e.target.value })} className="w-full bg-gray-900 border border-gray-600 rounded p-2 text-white" />
                  </div>
                  <button type="submit" className="bg-red-600 hover:bg-red-700 px-6 py-2 rounded text-white font-bold">Add</button>
                </form>
              </div>

              <div className="bg-gray-800 rounded-lg border border-gray-700 overflow-hidden">
                <table className="w-full text-left">
                  <thead className="bg-gray-900 text-gray-400 text-xs uppercase">
                    <tr><th className="p-4">Username</th><th className="p-4">Role</th><th className="p-4 text-right">Actions</th></tr>
                  </thead>
                  <tbody className="divide-y divide-gray-700">
                    {users.map(user => (
                      <tr key={user.id}>
                        <td className="p-4">{user.username}</td>
                        <td className="p-4"><span className={`px-2 py-1 rounded text-xs ${user.role === 'admin' ? 'bg-purple-900 text-purple-200' : 'bg-green-900 text-green-200'}`}>{user.role}</span></td>
                        <td className="p-4 text-right">
                          <button onClick={() => handleDeleteUser(user.id)} className="text-red-400 hover:text-red-300 disabled:opacity-30" disabled={user.username === 'admin'}><i className="fas fa-trash"></i></button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* === SETTINGS TAB === */}
          {activeTab === 'settings' && (
              <div className="max-w-4xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-8">
                  
                  {/* Password Change Card */}
                  <div className="bg-gray-800 rounded-lg p-8 border border-gray-700 shadow-xl">
                      <div className="text-center mb-6">
                          <div className="w-16 h-16 bg-gray-700 rounded-full flex items-center justify-center mx-auto mb-4">
                              <i className="fas fa-key text-2xl text-red-500"></i>
                          </div>
                          <h3 className="text-xl font-bold text-white">Change Password</h3>
                          <p className="text-gray-400 text-sm mt-2">Update credentials for your admin account.</p>
                      </div>
                      
                      <form onSubmit={handleUpdatePassword} className="space-y-5">
                          <div>
                              <label className="block text-xs font-bold text-gray-500 uppercase mb-1">New Password</label>
                              <input 
                                  required 
                                  type="password"
                                  value={passwords.new} 
                                  onChange={e => setPasswords({ ...passwords, new: e.target.value })} 
                                  className="w-full bg-gray-900 border border-gray-600 rounded p-3 text-white focus:ring-1 focus:ring-red-500 outline-none" 
                              />
                          </div>
                          <div>
                              <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Confirm New Password</label>
                              <input 
                                  required 
                                  type="password"
                                  value={passwords.confirm} 
                                  onChange={e => setPasswords({ ...passwords, confirm: e.target.value })} 
                                  className="w-full bg-gray-900 border border-gray-600 rounded p-3 text-white focus:ring-1 focus:ring-red-500 outline-none" 
                              />
                          </div>
                          <button type="submit" className="w-full bg-red-600 hover:bg-red-700 py-3 rounded text-white font-bold transition-colors">
                              Update Password
                          </button>
                      </form>
                  </div>

                  {/* Sync / Backup Card */}
                  <div className="bg-gray-800 rounded-lg p-8 border border-gray-700 shadow-xl flex flex-col">
                      <div className="text-center mb-6">
                          <div className="w-16 h-16 bg-gray-700 rounded-full flex items-center justify-center mx-auto mb-4">
                              <i className="fas fa-sync text-2xl text-blue-500"></i>
                          </div>
                          <h3 className="text-xl font-bold text-white">Device Synchronization</h3>
                          <p className="text-gray-400 text-sm mt-2">Transfer your playlists to other devices.</p>
                      </div>

                      <div className="flex-1 flex flex-col justify-center space-y-6">
                          <div className="p-4 bg-gray-900/50 rounded border border-gray-600 text-sm text-gray-300">
                              <p className="mb-2"><strong className="text-white">To use on another device:</strong></p>
                              <ol className="list-decimal pl-5 space-y-1">
                                  <li>Click <strong>Export</strong> below to download backup.</li>
                                  <li>Send the file to your other device (mobile/tablet).</li>
                                  <li>Log in on that device (Admin).</li>
                                  <li>Click <strong>Import</strong> and select the file.</li>
                              </ol>
                          </div>

                          <button onClick={handleExportBackup} className="w-full bg-blue-600 hover:bg-blue-700 py-3 rounded text-white font-bold transition-colors flex items-center justify-center gap-2">
                              <i className="fas fa-download"></i> Export Configuration
                          </button>

                          <div className="relative">
                              <button className="w-full bg-gray-700 hover:bg-gray-600 py-3 rounded text-white font-bold transition-colors flex items-center justify-center gap-2 pointer-events-none">
                                  <i className="fas fa-upload"></i> Import Configuration
                              </button>
                              <input 
                                type="file" 
                                accept=".json"
                                onChange={handleImportBackup}
                                className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                              />
                          </div>
                      </div>
                  </div>
              </div>
          )}

          {/* === PLAYLISTS TAB === */}
          {activeTab === 'playlists' && !editingPlaylistId && (
              <div className="max-w-4xl mx-auto">
                  {/* Create New Group */}
                  <div className="bg-gray-800 rounded-lg p-6 mb-8 border border-gray-700 shadow-lg">
                    <h3 className="text-lg font-bold mb-4">Create New Playlist</h3>
                    <form onSubmit={handleCreatePlaylist} className="flex gap-4">
                        <input 
                            required 
                            placeholder="Playlist Name (e.g. Live TV, Movies, Sports)" 
                            value={newPlaylistName}
                            onChange={e => setNewPlaylistName(e.target.value)}
                            className="flex-1 bg-gray-900 border border-gray-600 rounded p-3 text-white focus:ring-1 focus:ring-red-500 outline-none"
                        />
                        <button type="submit" className="bg-red-600 hover:bg-red-700 px-6 py-2 rounded text-white font-bold whitespace-nowrap">
                            <i className="fas fa-plus mr-2"></i> Create
                        </button>
                    </form>
                  </div>

                  {/* List of Groups */}
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                      {playlists.map(pl => (
                          <div key={pl.id} className="bg-gray-800 border border-gray-700 rounded-xl overflow-hidden hover:border-gray-500 transition-all flex flex-col h-48">
                              <div className="p-4 bg-gray-900/50 border-b border-gray-700 flex justify-between items-center">
                                  <h3 className="font-bold text-lg truncate" title={pl.name}>{pl.name}</h3>
                                  <button onClick={() => handleDeletePlaylist(pl.id)} className="text-gray-500 hover:text-red-500"><i className="fas fa-trash"></i></button>
                              </div>
                              <div className="p-4 flex-1 flex flex-col justify-center items-center text-gray-400">
                                  <span className="text-3xl font-bold text-white mb-1">{pl.sources.length}</span>
                                  <span className="text-sm">Sources Linked</span>
                              </div>
                              <div className="p-3 bg-gray-900/30 border-t border-gray-700 flex gap-2">
                                  <button onClick={() => setEditingPlaylistId(pl.id)} className="flex-1 bg-gray-700 hover:bg-gray-600 py-2 rounded text-sm text-white transition-colors">
                                      <i className="fas fa-edit mr-2"></i> Manage Sources
                                  </button>
                                  <button onClick={() => onPreview(pl)} className="px-3 bg-blue-900/30 text-blue-300 hover:bg-blue-900/50 rounded border border-blue-900/50" title="Preview">
                                      <i className="fas fa-play"></i>
                                  </button>
                              </div>
                          </div>
                      ))}
                      {playlists.length === 0 && (
                          <div className="col-span-full text-center py-12 text-gray-500 bg-gray-800/50 rounded-lg border border-dashed border-gray-700">
                              Create a playlist above to get started.
                          </div>
                      )}
                  </div>
              </div>
          )}

          {/* === EDITING A PLAYLIST === */}
          {activeTab === 'playlists' && editingPlaylistId && activePlaylist && (
              <div className="max-w-5xl mx-auto">
                  <button onClick={() => setEditingPlaylistId(null)} className="mb-4 text-gray-400 hover:text-white flex items-center gap-2">
                      <i className="fas fa-arrow-left"></i> Back to Playlists
                  </button>

                  <h2 className="text-2xl font-bold mb-6 flex items-center gap-3">
                      <span className="text-red-500">Editing:</span> {activePlaylist.name}
                  </h2>

                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                      {/* Left: Add Sources */}
                      <div className="lg:col-span-1 space-y-6">
                          <div className="bg-gray-800 p-5 rounded-lg border border-gray-700">
                              <h4 className="font-bold mb-3 text-sm uppercase text-gray-400">Add from URLs</h4>
                              <textarea
                                  placeholder={`https://site.com/list.m3u\nhttps://site.com/list2.m3u`}
                                  value={sourceUrls}
                                  onChange={e => setSourceUrls(e.target.value)}
                                  className="w-full bg-gray-900 border border-gray-600 rounded p-2 text-sm h-32 mb-2 font-mono focus:ring-1 focus:ring-red-500 outline-none"
                              />
                              <button 
                                  onClick={() => handleAddUrls(activePlaylist.id)} 
                                  disabled={uploadLoading}
                                  className="w-full bg-blue-600 hover:bg-blue-700 py-2 rounded text-white text-sm font-bold transition-colors"
                              >
                                  {uploadLoading ? 'Processing...' : 'Fetch & Add URLs'}
                              </button>
                          </div>

                          <div className="bg-gray-800 p-5 rounded-lg border border-gray-700">
                              <h4 className="font-bold mb-3 text-sm uppercase text-gray-400">Upload Files</h4>
                              <label className="cursor-pointer bg-gray-900 hover:bg-gray-700 border border-dashed border-gray-600 rounded p-6 flex flex-col items-center justify-center transition-colors">
                                  <i className="fas fa-file-upload text-2xl mb-2 text-gray-500"></i>
                                  <span className="text-xs text-gray-300">Select .m3u files</span>
                                  <input type="file" multiple accept=".m3u,.m3u8" onChange={(e) => handleFileUpload(e, activePlaylist.id)} className="hidden" />
                              </label>
                          </div>
                      </div>

                      {/* Right: Current Sources */}
                      <div className="lg:col-span-2">
                          <div className="bg-gray-800 rounded-lg border border-gray-700 overflow-hidden min-h-[400px]">
                              <div className="p-4 bg-gray-900 border-b border-gray-700 flex justify-between items-center">
                                  <h3 className="font-bold">Active Sources ({activePlaylist.sources.length})</h3>
                                  <span className="text-xs text-gray-500">All these are merged automatically</span>
                              </div>
                              <div className="divide-y divide-gray-700">
                                  {activePlaylist.sources.length === 0 ? (
                                      <div className="p-10 text-center text-gray-500">
                                          <i className="fas fa-inbox text-4xl mb-3 opacity-30"></i>
                                          <p>No sources added yet.</p>
                                          <p className="text-xs">Add URLs or Files to populate this playlist.</p>
                                      </div>
                                  ) : (
                                      activePlaylist.sources.map(src => (
                                          <div key={src.id} className="p-4 flex items-center justify-between hover:bg-gray-750">
                                              <div className="flex items-center gap-3 overflow-hidden">
                                                  <div className={`w-8 h-8 rounded flex items-center justify-center shrink-0 ${src.type === 'url' ? 'bg-blue-900/30 text-blue-400' : 'bg-purple-900/30 text-purple-400'}`}>
                                                      <i className={`fas ${src.type === 'url' ? 'fa-link' : 'fa-file'}`}></i>
                                                  </div>
                                                  <div className="min-w-0">
                                                      <p className="font-medium truncate text-sm text-white">{src.identifier}</p>
                                                      <p className="text-xs text-gray-500">{new Date(src.addedAt).toLocaleDateString()} • {src.content.length > 1024 ? Math.round(src.content.length / 1024) + ' KB' : src.content.length + ' B'}</p>
                                                  </div>
                                              </div>
                                              <button onClick={() => handleRemoveSource(activePlaylist.id, src.id)} className="text-gray-500 hover:text-red-500 p-2">
                                                  <i className="fas fa-times"></i>
                                              </button>
                                          </div>
                                      ))
                                  )}
                              </div>
                          </div>
                      </div>
                  </div>
              </div>
          )}
        </main>
      </div>
    </div>
  );
};

export default AdminDashboard;