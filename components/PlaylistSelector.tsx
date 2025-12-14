import React from 'react';
import { StoredPlaylist } from '../types';

interface PlaylistSelectorProps {
  playlists: StoredPlaylist[];
  onSelect: (playlist: StoredPlaylist) => void;
  onSelectAll: () => void;
  onLogout: () => void;
  isAdmin: boolean;
}

const PlaylistSelector: React.FC<PlaylistSelectorProps> = ({ playlists, onSelect, onSelectAll, onLogout, isAdmin }) => {
  return (
    <div className="min-h-screen bg-gray-900 flex flex-col items-center p-8">
      <div className="w-full max-w-4xl">
        <div className="flex justify-between items-center mb-10 border-b border-gray-700 pb-4">
            <h1 className="text-3xl font-bold text-white flex items-center gap-3">
                <i className="fas fa-play-circle text-red-500"></i> StreamFlow
            </h1>
            <button onClick={onLogout} className="text-gray-400 hover:text-white flex items-center gap-2">
                <i className="fas fa-sign-out-alt"></i> Logout
            </button>
        </div>

        <h2 className="text-xl text-gray-300 mb-6">Select a Playlist</h2>
        
        {playlists.length === 0 ? (
           <div className="text-center py-20 bg-gray-800 rounded-lg border border-gray-700">
               <i className="fas fa-folder-open text-5xl text-gray-600 mb-4"></i>
               <p className="text-gray-400 text-lg">No playlists available.</p>
               <p className="text-gray-500 text-sm mt-2">Please contact the administrator to add content.</p>
           </div>
        ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                
                {/* All Combined Option */}
                {playlists.length > 1 && (
                    <button 
                        onClick={onSelectAll}
                        className="col-span-full md:col-span-full bg-gradient-to-r from-red-900 to-gray-900 hover:from-red-800 hover:to-gray-800 border border-red-700/50 rounded-xl p-6 text-left transition-all shadow-xl group relative overflow-hidden flex items-center gap-6"
                    >
                        <div className="w-14 h-14 bg-red-600 rounded-full flex items-center justify-center shadow-lg shrink-0">
                            <i className="fas fa-layer-group text-2xl text-white"></i>
                        </div>
                        <div>
                            <h3 className="text-xl font-bold text-white mb-1">Unified Library</h3>
                            <p className="text-gray-300 text-sm">Merge all {playlists.length} playlists into one.</p>
                        </div>
                    </button>
                )}

                {/* Individual Playlists */}
                {playlists.map(pl => (
                    <button 
                        key={pl.id} 
                        onClick={() => onSelect(pl)}
                        className="bg-gray-800 hover:bg-gray-700 border border-gray-700 hover:border-gray-500 rounded-xl p-6 text-left transition-all group relative overflow-hidden flex flex-col h-40"
                    >
                        <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                            <i className="fas fa-tv text-6xl"></i>
                        </div>
                        
                        <div className="relative z-10 flex-1">
                            <h3 className="text-xl font-bold text-white mb-2 group-hover:text-red-400 transition-colors truncate" title={pl.name}>{pl.name}</h3>
                            <div className="flex items-center text-sm text-gray-500">
                                <span className="bg-gray-900 px-2 py-1 rounded text-xs border border-gray-600">
                                    {pl.sources.length} Source{pl.sources.length !== 1 ? 's' : ''}
                                </span>
                            </div>
                        </div>
                        
                        <div className="relative z-10 mt-4 flex items-center text-xs text-gray-400 group-hover:text-gray-300">
                            <span>Click to watch</span>
                            <i className="fas fa-arrow-right ml-2 opacity-0 group-hover:opacity-100 transition-opacity transform translate-x-[-5px] group-hover:translate-x-0"></i>
                        </div>
                    </button>
                ))}
            </div>
        )}

        {isAdmin && (
            <div className="mt-12 text-center">
                 <p className="text-gray-500 text-sm mb-2">You are logged in as Admin</p>
                 <button onClick={() => window.location.reload()} className="text-blue-400 hover:underline">Return to Dashboard (Reload)</button>
            </div>
        )}
      </div>
    </div>
  );
};

export default PlaylistSelector;