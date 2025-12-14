import React, { useState, useEffect, useCallback } from 'react';
import { Channel, PlaylistData, User } from './types';
import { parseM3U } from './services/m3uParser';
import { apiService } from './services/api'; // Changed from storageService
import VideoPlayer from './components/VideoPlayer';
import Sidebar from './components/Sidebar';
import Login from './components/Login';
import AdminDashboard from './components/AdminDashboard';

const App: React.FC = () => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [view, setView] = useState<'login' | 'dashboard' | 'player'>('login');
  
  const [playlistData, setPlaylistData] = useState<PlaylistData | null>(null);
  const [currentChannel, setCurrentChannel] = useState<Channel | null>(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const user = apiService.getCurrentUser();
    if (user) {
      handleLoginSuccess(user);
    }
  }, []);

  const handleLoginSuccess = (user: User) => {
    setCurrentUser(user);
    if (user.role === 'admin') {
      setView('dashboard');
    } else {
      // If user is client, auto-load their assigned streams
      handleLoadClientStreams();
    }
  };

  const handleLogout = () => {
    apiService.logout();
    setCurrentUser(null);
    setPlaylistData(null);
    setCurrentChannel(null);
    setView('login');
  };

  const handleLoadClientStreams = useCallback(async () => {
      setLoading(true);
      try {
          // Fetch unified playlist from VPS Backend
          const m3uContent = await apiService.getLiveStreams();
          const data = parseM3U(m3uContent);
          
          if (data.channels.length === 0) {
              alert("No channels assigned to this line.");
              setLoading(false);
              return;
          }

          setPlaylistData(data);
          setCurrentChannel(data.channels[0]);
          setView('player');
      } catch (e) {
          console.error(e);
          alert("Failed to load streams from server.");
      } finally {
          setLoading(false);
      }
  }, []);

  const handleChannelSelect = (channel: Channel) => {
    setCurrentChannel(channel);
    setMobileMenuOpen(false);
  };

  if (loading) {
      return (
          <div className="min-h-screen bg-gray-900 flex flex-col items-center justify-center text-white">
              <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mb-4"></div>
              <p>Connecting to VPS...</p>
          </div>
      );
  }

  if (!currentUser || view === 'login') {
    return <Login onLogin={handleLoginSuccess} />;
  }

  if (view === 'dashboard' && currentUser.role === 'admin') {
    return (
        <AdminDashboard 
            onLogout={handleLogout} 
            onPreview={() => handleLoadClientStreams()} // Admins can preview stream flow
        />
    );
  }

  // --- PLAYER VIEW ---
  if (view === 'player' && playlistData) {
    return (
        <div className="flex flex-col h-screen bg-black overflow-hidden relative">
        <div className="md:hidden bg-gray-900 p-4 border-b border-gray-700 flex justify-between items-center z-50">
            <div className="font-bold text-blue-500 flex items-center gap-2">
                <i className="fas fa-play-circle"></i> StreamFlow VPS
            </div>
            <button 
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className="text-white p-2"
            >
                <i className={`fas ${mobileMenuOpen ? 'fa-times' : 'fa-bars'}`}></i>
            </button>
        </div>

        <div className="flex flex-1 overflow-hidden relative">
            <div className={`
                absolute md:static inset-0 z-40 transform transition-transform duration-300 ease-in-out
                ${mobileMenuOpen ? 'translate-x-0' : '-translate-x-full'} 
                md:translate-x-0 flex
            `}>
            <Sidebar 
                channels={playlistData.channels} 
                currentChannel={currentChannel}
                onSelectChannel={handleChannelSelect}
                groups={playlistData.groups}
            />
            </div>

            <div className="flex-1 flex flex-col w-full h-full relative">
            <div className="h-14 bg-gray-900/90 border-b border-gray-800 flex items-center justify-between px-6 shrink-0">
                <div className="flex items-center gap-3 overflow-hidden">
                    {currentChannel?.logo && (
                        <img src={currentChannel.logo} className="h-8 w-8 object-contain rounded" alt="" />
                    )}
                    <h2 className="text-lg font-semibold truncate text-white">{currentChannel?.name || 'Select a Channel'}</h2>
                </div>
                <div className="flex items-center gap-4">
                    {currentUser.role === 'admin' && (
                        <button onClick={() => setView('dashboard')} className="text-xs bg-gray-800 px-3 py-1 rounded border border-gray-600">Back to Panel</button>
                    )}
                    <button 
                        onClick={handleLogout}
                        className="text-sm text-gray-400 hover:text-white flex items-center gap-2 px-3 py-1 rounded hover:bg-gray-800 transition-colors"
                    >
                        <i className="fas fa-sign-out-alt"></i>
                    </button>
                </div>
            </div>

            <div className="flex-1 bg-black relative">
                {currentChannel ? (
                <VideoPlayer 
                    url={currentChannel.url} 
                    poster={currentChannel.logo}
                />
                ) : (
                    <div className="h-full flex items-center justify-center text-gray-500">
                        <div className="text-center">
                            <i className="fas fa-tv text-6xl mb-4 opacity-50"></i>
                            <p>Select a channel</p>
                        </div>
                    </div>
                )}
            </div>
            </div>
        </div>
        </div>
    );
  }

  return <div className="text-white p-10">Something went wrong. Reload.</div>;
};

export default App;