import React, { useState, useEffect, useCallback } from 'react';
import { Channel, PlaylistData, User, StoredPlaylist } from './types';
import { parseM3U } from './services/m3uParser';
import { storageService } from './services/storage';
import VideoPlayer from './components/VideoPlayer';
import Sidebar from './components/Sidebar';
import Login from './components/Login';
import AdminDashboard from './components/AdminDashboard';
import PlaylistSelector from './components/PlaylistSelector';

const App: React.FC = () => {
  // Auth State
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  
  // Navigation State
  const [view, setView] = useState<'login' | 'dashboard' | 'selector' | 'player'>('login');
  
  // Player Data State
  const [playlistData, setPlaylistData] = useState<PlaylistData | null>(null);
  const [currentChannel, setCurrentChannel] = useState<Channel | null>(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const user = storageService.getCurrentUser();
    if (user) {
      handleLoginSuccess(user);
    }
  }, []);

  const handleLoginSuccess = (user: User) => {
    setCurrentUser(user);
    if (user.role === 'admin') {
      setView('dashboard');
    } else {
      setView('selector');
    }
  };

  const handleLogout = () => {
    storageService.logout();
    setCurrentUser(null);
    setPlaylistData(null);
    setCurrentChannel(null);
    setView('login');
  };

  // Called when loading a specific Playlist Collection (e.g. "Live TV")
  // It merges ALL sources inside that collection
  const handleLoadPlaylist = useCallback((storedPlaylist: StoredPlaylist) => {
    setLoading(true);
    setTimeout(() => {
      try {
        let mergedChannels: Channel[] = [];
        const mergedGroups = new Set<string>();
        
        if (storedPlaylist.sources.length === 0) {
            alert("This playlist has no sources/links yet.");
            setLoading(false);
            return;
        }

        storedPlaylist.sources.forEach(source => {
            try {
                const data = parseM3U(source.content);
                mergedChannels = [...mergedChannels, ...data.channels];
                data.groups.forEach(g => mergedGroups.add(g));
            } catch (err) {
                console.error(`Error parsing source: ${source.identifier}`, err);
            }
        });

        if (mergedChannels.length === 0) {
             alert("No playable channels found in the sources.");
             setLoading(false);
             return;
        }

        setPlaylistData({
            channels: mergedChannels,
            groups: Array.from(mergedGroups).sort()
        });

        if (mergedChannels.length > 0) {
          setCurrentChannel(mergedChannels[0]);
        }
        setView('player');
      } catch (e) {
        console.error("General parsing error", e);
        alert("Failed to load playlist.");
      } finally {
        setLoading(false);
      }
    }, 100);
  }, []);

  // Merges EVERY source from EVERY playlist collection
  const handleLoadAllPlaylists = useCallback(() => {
    setLoading(true);
    setTimeout(() => {
        try {
            const allPlaylists = storageService.getPlaylists();
            let mergedChannels: Channel[] = [];
            const mergedGroups = new Set<string>();

            // Loop through every Playlist Collection
            allPlaylists.forEach(pl => {
                // Loop through every source in that collection
                pl.sources.forEach(source => {
                    try {
                        const data = parseM3U(source.content);
                        mergedChannels = [...mergedChannels, ...data.channels];
                        data.groups.forEach(g => mergedGroups.add(g));
                    } catch (e) {
                        console.warn(`Failed to parse source: ${source.identifier}`);
                    }
                });
            });

            if (mergedChannels.length === 0) {
                alert("No channels found in storage.");
                setLoading(false);
                return;
            }

            setPlaylistData({
                channels: mergedChannels,
                groups: Array.from(mergedGroups).sort()
            });
            setCurrentChannel(mergedChannels[0]);
            setView('player');

        } catch (e) {
            console.error("Merge error", e);
            alert("Error loading merged playlists.");
        } finally {
            setLoading(false);
        }
    }, 100);
  }, []);

  const handleChannelSelect = (channel: Channel) => {
    setCurrentChannel(channel);
    setMobileMenuOpen(false);
  };

  const handleBackToMenu = () => {
      if (currentUser?.role === 'admin') {
          setView('dashboard');
      } else {
          setView('selector');
      }
      setPlaylistData(null);
      setCurrentChannel(null);
  };

  // --- RENDER LOGIC ---

  if (loading) {
      return (
          <div className="min-h-screen bg-gray-900 flex flex-col items-center justify-center text-white">
              <div className="w-12 h-12 border-4 border-red-600 border-t-transparent rounded-full animate-spin mb-4"></div>
              <p>Loading Content...</p>
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
            onPreview={handleLoadPlaylist} 
        />
    );
  }

  if (view === 'selector') {
      return (
          <PlaylistSelector 
            playlists={storageService.getPlaylists()} 
            onSelect={handleLoadPlaylist}
            onSelectAll={handleLoadAllPlaylists}
            onLogout={handleLogout}
            isAdmin={currentUser.role === 'admin'}
          />
      );
  }

  // --- PLAYER VIEW ---
  if (view === 'player' && playlistData) {
    return (
        <div className="flex flex-col h-screen bg-black overflow-hidden relative">
        {/* Mobile Header */}
        <div className="md:hidden bg-gray-900 p-4 border-b border-gray-700 flex justify-between items-center z-50">
            <div className="font-bold text-red-500 flex items-center gap-2">
                <i className="fas fa-play-circle"></i> StreamFlow
            </div>
            <button 
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className="text-white p-2"
            >
                <i className={`fas ${mobileMenuOpen ? 'fa-times' : 'fa-bars'}`}></i>
            </button>
        </div>

        <div className="flex flex-1 overflow-hidden relative">
            {/* Sidebar */}
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

            {/* Main Content Area */}
            <div className="flex-1 flex flex-col w-full h-full relative">
            
            {/* Top Bar */}
            <div className="h-14 bg-gray-900/90 border-b border-gray-800 flex items-center justify-between px-6 shrink-0">
                <div className="flex items-center gap-3 overflow-hidden">
                    {currentChannel?.logo && (
                        <img src={currentChannel.logo} className="h-8 w-8 object-contain rounded" alt="" />
                    )}
                    <h2 className="text-lg font-semibold truncate text-white">{currentChannel?.name || 'Select a Channel'}</h2>
                </div>
                <button 
                    onClick={handleBackToMenu}
                    className="text-sm text-gray-400 hover:text-white flex items-center gap-2 px-3 py-1 rounded hover:bg-gray-800 transition-colors"
                >
                    <i className="fas fa-arrow-left"></i>
                    <span className="hidden sm:inline">Back to Menu</span>
                </button>
            </div>

            {/* Player Wrapper */}
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
                            <p>Select a channel to start watching</p>
                        </div>
                    </div>
                )}
            </div>
            </div>
        </div>
        </div>
    );
  }

  // Fallback
  return <div className="text-white p-10">Something went wrong. Reload.</div>;
};

export default App;