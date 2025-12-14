export type Role = 'admin' | 'user';

export interface User {
  id: string;
  username: string;
  password: string; // In a real app, this should be hashed!
  role: Role;
}

export interface PlaylistSource {
  id: string;
  type: 'url' | 'file';
  content: string; // The raw M3U content
  identifier: string; // The URL string or Filename
  addedAt: number;
}

export interface StoredPlaylist {
  id: string;
  name: string; // The display name of the collection (e.g. "Live TV")
  sources: PlaylistSource[]; // List of M3U sources merged into this playlist
}

export interface Channel {
  id: string;
  name: string;
  logo: string | null;
  url: string;
  group?: string;
}

export interface PlaylistData {
  channels: Channel[];
  groups: string[];
}