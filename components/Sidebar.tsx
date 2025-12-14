import React, { useMemo, useState } from 'react';
import { Channel } from '../types';

interface SidebarProps {
  channels: Channel[];
  currentChannel: Channel | null;
  onSelectChannel: (channel: Channel) => void;
  groups: string[];
}

const Sidebar: React.FC<SidebarProps> = ({ channels, currentChannel, onSelectChannel, groups }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedGroup, setSelectedGroup] = useState('All');

  const filteredChannels = useMemo(() => {
    return channels.filter((c) => {
      const matchesSearch = c.name.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesGroup = selectedGroup === 'All' || c.group === selectedGroup;
      return matchesSearch && matchesGroup;
    });
  }, [channels, searchTerm, selectedGroup]);

  return (
    <div className="flex flex-col h-full bg-gray-800 border-r border-gray-700 w-full md:w-80 lg:w-96 shrink-0">
      {/* Header / Search */}
      <div className="p-4 bg-gray-900 border-b border-gray-700 sticky top-0 z-10">
        <h2 className="text-xl font-bold text-red-500 mb-4 flex items-center gap-2">
            <i className="fas fa-play-circle"></i> StreamFlow
        </h2>
        
        <div className="relative mb-3">
          <input
            type="text"
            placeholder="Search channels..."
            className="w-full bg-gray-800 text-white border border-gray-600 rounded-md py-2 px-4 pl-10 focus:outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500 transition-all"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
          <i className="fas fa-search absolute left-3 top-3 text-gray-400"></i>
        </div>

        <select
          value={selectedGroup}
          onChange={(e) => setSelectedGroup(e.target.value)}
          className="w-full bg-gray-800 text-gray-300 border border-gray-600 rounded-md py-1 px-2 text-sm focus:outline-none focus:border-gray-500"
        >
          <option value="All">All Categories</option>
          {groups.map(g => <option key={g} value={g}>{g}</option>)}
        </select>
        
        <div className="mt-2 text-xs text-gray-500 font-mono">
            {filteredChannels.length} channels found
        </div>
      </div>

      {/* Channel List */}
      <div className="flex-1 overflow-y-auto p-2 space-y-1">
        {filteredChannels.length === 0 ? (
          <div className="text-center py-10 text-gray-500">
            <p>No channels found</p>
          </div>
        ) : (
          filteredChannels.map((channel) => (
            <button
              key={channel.id}
              onClick={() => onSelectChannel(channel)}
              className={`w-full flex items-center gap-3 p-3 rounded-md transition-all duration-200 group text-left ${
                currentChannel?.id === channel.id
                  ? 'bg-red-600 text-white shadow-lg transform scale-[1.02]'
                  : 'text-gray-300 hover:bg-gray-700 hover:text-white'
              }`}
            >
              <div className="w-10 h-10 bg-gray-900 rounded-full flex items-center justify-center shrink-0 overflow-hidden border border-gray-600">
                {channel.logo ? (
                  <img src={channel.logo} alt={channel.name} className="w-full h-full object-cover" onError={(e) => (e.currentTarget.style.display = 'none')} />
                ) : (
                  <i className="fas fa-tv text-gray-500"></i>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium truncate">{channel.name}</p>
                {channel.group && (
                   <p className={`text-xs truncate ${currentChannel?.id === channel.id ? 'text-red-200' : 'text-gray-500 group-hover:text-gray-400'}`}>
                    {channel.group}
                   </p>
                )}
              </div>
              {currentChannel?.id === channel.id && (
                  <i className="fas fa-volume-high animate-pulse"></i>
              )}
            </button>
          ))
        )}
      </div>
    </div>
  );
};

export default Sidebar;