import axios from 'axios';
import { User, StoredPlaylist } from '../types';

// Detect if we are in dev (Vite proxy) or prod
const API_URL = '/api';

const getAuthHeader = () => {
    const token = localStorage.getItem('token');
    return token ? { Authorization: `Bearer ${token}` } : {};
};

export const apiService = {
    // --- Auth ---
    login: async (username: string, password: string) => {
        try {
            const res = await axios.post(`${API_URL}/login`, { username, password });
            if (res.data.token) {
                localStorage.setItem('token', res.data.token);
                localStorage.setItem('user', JSON.stringify(res.data.user));
            }
            return res.data.user;
        } catch (e: any) {
            throw new Error(e.response?.data?.error || 'Login failed');
        }
    },

    logout: () => {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
    },

    getCurrentUser: (): User | null => {
        const u = localStorage.getItem('user');
        return u ? JSON.parse(u) : null;
    },

    // --- Users (Admin) ---
    getUsers: async (): Promise<User[]> => {
        const res = await axios.get(`${API_URL}/users`, { headers: getAuthHeader() });
        return res.data;
    },

    addUser: async (userData: any) => {
        const res = await axios.post(`${API_URL}/users`, userData, { headers: getAuthHeader() });
        return res.data;
    },

    deleteUser: async (id: string) => {
        await axios.delete(`${API_URL}/users/${id}`, { headers: getAuthHeader() });
    },

    // --- Playlists (Admin) ---
    getPlaylists: async (): Promise<StoredPlaylist[]> => {
        const res = await axios.get(`${API_URL}/playlists`, { headers: getAuthHeader() });
        // Map backend format to frontend type expected by Dashboard
        return res.data.map((p: any) => ({
            id: p.id,
            name: p.name,
            sources: p.source_url ? [{ id: p.id, type: 'url', identifier: p.source_url, content: '', addedAt: p.updated_at }] : []
        }));
    },

    createPlaylist: async (name: string, url: string) => {
        const res = await axios.post(`${API_URL}/playlists`, { 
            name, 
            source_url: url, 
            type: 'url' 
        }, { headers: getAuthHeader() });
        return res.data;
    },

    deletePlaylist: async (id: string) => {
        await axios.delete(`${API_URL}/playlists/${id}`, { headers: getAuthHeader() });
    },

    // --- Client Stream Fetching ---
    // This gets the unified M3U from the server (Xtream style)
    getLiveStreams: async (): Promise<string> => {
        const res = await axios.get(`${API_URL}/client/live`, { headers: getAuthHeader() });
        return res.data;
    }
};