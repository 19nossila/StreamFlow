import React, { useState, useEffect } from 'react';
import { apiService } from '../services/api';
import { User } from '../types';

interface AdminDashboardProps {
  onLogout: () => void;
  onPreview: () => void;
}

const AdminDashboard: React.FC<AdminDashboardProps> = ({ onLogout, onPreview }) => {
  const [activeTab, setActiveTab] = useState<'users' | 'playlists'>('users');
  
  // Data
  const [users, setUsers] = useState<any[]>([]);
  const [playlists, setPlaylists] = useState<any[]>([]);
  
  // Forms
  const [newUser, setNewUser] = useState({ username: '', password: '', exp_date: '' });
  const [newPlaylist, setNewPlaylist] = useState({ name: '', url: '' });
  const [msg, setMsg] = useState({ type: '', text: '' });

  useEffect(() => {
    loadData();
  }, [activeTab]);

  const loadData = async () => {
    try {
        if (activeTab === 'users') {
            const u = await apiService.getUsers();
            setUsers(u);
        } else {
            const p = await apiService.getPlaylists();
            setPlaylists(p);
        }
    } catch (e) {
        console.error(e);
    }
  };

  const handleAddUser = async (e: React.FormEvent) => {
      e.preventDefault();
      try {
          const expiration = newUser.exp_date ? new Date(newUser.exp_date).getTime() : null;
          await apiService.addUser({ 
              username: newUser.username, 
              password: newUser.password, 
              role: 'user',
              exp_date: expiration 
          });
          setMsg({ type: 'success', text: 'Client added successfully' });
          setNewUser({ username: '', password: '', exp_date: '' });
          loadData();
      } catch (e: any) {
          setMsg({ type: 'error', text: e.message });
      }
  };

  const handleDeleteUser = async (id: string) => {
      if (confirm('Delete User?')) {
          await apiService.deleteUser(id);
          loadData();
      }
  };

  const handleAddPlaylist = async (e: React.FormEvent) => {
      e.preventDefault();
      try {
          await apiService.createPlaylist(newPlaylist.name, newPlaylist.url);
          setMsg({ type: 'success', text: 'Playlist source added' });
          setNewPlaylist({ name: '', url: '' });
          loadData();
      } catch (e: any) {
           setMsg({ type: 'error', text: e.message });
      }
  };

  const handleDeletePlaylist = async (id: string) => {
      if(confirm('Delete Playlist?')) {
          await apiService.deletePlaylist(id);
          loadData();
      }
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white flex flex-col">
      <header className="bg-gray-800 border-b border-gray-700 p-4 flex justify-between items-center">
        <h1 className="text-xl font-bold text-blue-500"><i className="fas fa-server mr-2"></i>Xtream VPS Panel</h1>
        <button onClick={onLogout} className="text-gray-300 hover:text-white"><i className="fas fa-sign-out-alt"></i> Logout</button>
      </header>

      <div className="flex flex-1">
        <aside className="w-64 bg-gray-800 p-4 hidden md:block">
            <button onClick={() => setActiveTab('users')} className={`w-full text-left p-3 rounded mb-2 ${activeTab === 'users' ? 'bg-blue-600' : 'hover:bg-gray-700'}`}>
                <i className="fas fa-users mr-2"></i> Clients / Lines
            </button>
            <button onClick={() => setActiveTab('playlists')} className={`w-full text-left p-3 rounded mb-2 ${activeTab === 'playlists' ? 'bg-blue-600' : 'hover:bg-gray-700'}`}>
                <i className="fas fa-list mr-2"></i> Playlists
            </button>
        </aside>

        <main className="flex-1 p-6 overflow-y-auto">
            {msg.text && (
                <div className={`p-3 mb-4 rounded ${msg.type === 'error' ? 'bg-red-900/50 border border-red-500' : 'bg-green-900/50 border border-green-500'}`}>
                    {msg.text}
                </div>
            )}

            {activeTab === 'users' && (
                <div>
                    <div className="bg-gray-800 p-6 rounded-lg mb-6">
                        <h3 className="text-lg font-bold mb-4">Create New Line</h3>
                        <form onSubmit={handleAddUser} className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
                            <input placeholder="Username" required value={newUser.username} onChange={e => setNewUser({...newUser, username: e.target.value})} className="bg-gray-900 border border-gray-600 rounded p-2 text-white" />
                            <input placeholder="Password" required value={newUser.password} onChange={e => setNewUser({...newUser, password: e.target.value})} className="bg-gray-900 border border-gray-600 rounded p-2 text-white" />
                            <input type="date" title="Expiration Date" value={newUser.exp_date} onChange={e => setNewUser({...newUser, exp_date: e.target.value})} className="bg-gray-900 border border-gray-600 rounded p-2 text-white" />
                            <button className="bg-blue-600 hover:bg-blue-700 p-2 rounded font-bold">Create Line</button>
                        </form>
                    </div>
                    
                    <div className="bg-gray-800 rounded-lg overflow-hidden">
                        <table className="w-full text-left">
                            <thead className="bg-gray-900 text-gray-400">
                                <tr><th className="p-4">Username</th><th className="p-4">Role</th><th className="p-4">Expires</th><th className="p-4">Action</th></tr>
                            </thead>
                            <tbody className="divide-y divide-gray-700">
                                {users.map(u => (
                                    <tr key={u.id}>
                                        <td className="p-4">{u.username}</td>
                                        <td className="p-4"><span className={`px-2 py-1 rounded text-xs ${u.role === 'admin' ? 'bg-purple-900' : 'bg-green-900'}`}>{u.role}</span></td>
                                        <td className="p-4">{u.exp_date ? new Date(u.exp_date).toLocaleDateString() : 'Never'}</td>
                                        <td className="p-4"><button onClick={() => handleDeleteUser(u.id)} className="text-red-400 hover:text-red-200"><i className="fas fa-trash"></i></button></td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {activeTab === 'playlists' && (
                <div>
                    <div className="bg-gray-800 p-6 rounded-lg mb-6">
                        <h3 className="text-lg font-bold mb-4">Add Provider Source</h3>
                        <form onSubmit={handleAddPlaylist} className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
                            <input placeholder="Provider Name" required value={newPlaylist.name} onChange={e => setNewPlaylist({...newPlaylist, name: e.target.value})} className="bg-gray-900 border border-gray-600 rounded p-2 text-white" />
                            <input placeholder="M3U URL" required value={newPlaylist.url} onChange={e => setNewPlaylist({...newPlaylist, url: e.target.value})} className="bg-gray-900 border border-gray-600 rounded p-2 text-white" />
                            <button className="bg-blue-600 hover:bg-blue-700 p-2 rounded font-bold">Add Source</button>
                        </form>
                        <p className="text-xs text-gray-500 mt-2">These sources are aggregated and served to your clients automatically.</p>
                    </div>

                    <div className="space-y-4">
                        {playlists.map(pl => (
                            <div key={pl.id} className="bg-gray-800 p-4 rounded flex justify-between items-center border border-gray-700">
                                <div>
                                    <h4 className="font-bold">{pl.name}</h4>
                                    <p className="text-xs text-gray-500 truncate w-64">{pl.sources?.[0]?.identifier || pl.source_url}</p>
                                </div>
                                <button onClick={() => handleDeletePlaylist(pl.id)} className="text-red-400 hover:text-red-200"><i className="fas fa-trash"></i></button>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </main>
      </div>
    </div>
  );
};

export default AdminDashboard;