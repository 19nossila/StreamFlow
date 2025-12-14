import express from 'express';
import cors from 'cors';
import sqlite3 from 'sqlite3';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import fs from 'fs';
import axios from 'axios';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;
const SECRET_KEY = 'xtream_secret_key_change_me_on_vps';

app.use(cors());
app.use(express.json({ limit: '50mb' }));

// --- DATABASE SETUP (SQLite) ---
const dbPath = join(__dirname, 'database.sqlite');
const db = new sqlite3.Database(dbPath);

db.serialize(() => {
  // Users Table (Admins and Clients)
  db.run(`CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    username TEXT UNIQUE,
    password TEXT,
    role TEXT, -- 'admin' or 'user'
    exp_date INTEGER, -- Expiration Timestamp
    max_connections INTEGER DEFAULT 1,
    created_at INTEGER
  )`);

  // Playlists Table (Managed by Admin)
  db.run(`CREATE TABLE IF NOT EXISTS playlists (
    id TEXT PRIMARY KEY,
    name TEXT,
    source_url TEXT, -- The real M3U URL (hidden from user)
    content TEXT, -- Cached Content if file upload
    type TEXT, -- 'url' or 'file'
    updated_at INTEGER
  )`);

  // Create Default Admin if not exists
  const adminId = 'admin-root';
  db.get("SELECT * FROM users WHERE username = ?", ['admin'], (err, row) => {
    if (!row) {
      const hash = bcrypt.hashSync('admin', 10);
      db.run("INSERT INTO users (id, username, password, role, created_at) VALUES (?, ?, ?, ?, ?)", 
        [adminId, 'admin', hash, 'admin', Date.now()]
      );
      console.log("Default Admin created: admin / admin");
    }
  });
});

// --- MIDDLEWARE ---
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) return res.sendStatus(401);

  jwt.verify(token, SECRET_KEY, (err, user) => {
    if (err) return res.sendStatus(403);
    req.user = user;
    next();
  });
};

const isAdmin = (req, res, next) => {
  if (req.user.role !== 'admin') return res.sendStatus(403);
  next();
};

// --- AUTH ROUTES ---
app.post('/api/login', (req, res) => {
  const { username, password } = req.body;
  db.get("SELECT * FROM users WHERE username = ?", [username], (err, user) => {
    if (err || !user) return res.status(401).json({ error: "User not found" });
    
    if (bcrypt.compareSync(password, user.password)) {
      // Check Expiration for normal users
      if (user.role !== 'admin' && user.exp_date && user.exp_date < Date.now()) {
          return res.status(403).json({ error: "Account Expired" });
      }

      const token = jwt.sign({ id: user.id, username: user.username, role: user.role }, SECRET_KEY, { expiresIn: '24h' });
      res.json({ token, user: { id: user.id, username: user.username, role: user.role } });
    } else {
      res.status(401).json({ error: "Invalid password" });
    }
  });
});

// --- ADMIN ROUTES (Manage Panel) ---
app.get('/api/users', authenticateToken, isAdmin, (req, res) => {
    db.all("SELECT id, username, role, exp_date, created_at FROM users", [], (err, rows) => {
        res.json(rows);
    });
});

app.post('/api/users', authenticateToken, isAdmin, (req, res) => {
    const { username, password, role, exp_date } = req.body;
    const id = Math.random().toString(36).substr(2, 9);
    const hash = bcrypt.hashSync(password, 10);
    const created_at = Date.now();
    
    db.run("INSERT INTO users (id, username, password, role, exp_date, created_at) VALUES (?, ?, ?, ?, ?, ?)",
        [id, username, hash, role, exp_date, created_at],
        function(err) {
            if (err) return res.status(400).json({ error: err.message });
            res.json({ id, username, role });
        }
    );
});

app.delete('/api/users/:id', authenticateToken, isAdmin, (req, res) => {
    db.run("DELETE FROM users WHERE id = ?", [req.params.id], (err) => {
        if (err) return res.status(500).json({error: err.message});
        res.json({ success: true });
    });
});

// --- PLAYLIST ROUTES ---

// Admin: Add Playlist source
app.post('/api/playlists', authenticateToken, isAdmin, async (req, res) => {
    const { name, source_url, type, content } = req.body;
    const id = Math.random().toString(36).substr(2, 9);
    const updated_at = Date.now();

    db.run("INSERT INTO playlists (id, name, source_url, content, type, updated_at) VALUES (?, ?, ?, ?, ?, ?)",
        [id, name, source_url, content, type, updated_at],
        (err) => {
            if (err) return res.status(500).json({ error: err.message });
            res.json({ id, name });
        }
    );
});

// Admin: List Playlists
app.get('/api/playlists', authenticateToken, isAdmin, (req, res) => {
    db.all("SELECT id, name, type, source_url, updated_at FROM playlists", [], (err, rows) => {
        res.json(rows);
    });
});

app.delete('/api/playlists/:id', authenticateToken, isAdmin, (req, res) => {
    db.run("DELETE FROM playlists WHERE id = ?", [req.params.id], (err) => {
        if (err) return res.status(500).json({error: err.message});
        res.json({success: true});
    });
});

// --- CLIENT ROUTES (Xtream Logic) ---

// Client: Get My Channels (Proxied/Aggregated)
// This mimics fetching the M3U, but handled by the server
app.get('/api/client/live', authenticateToken, async (req, res) => {
    // In a real Xtream UI, you would assign specific playlists to specific users.
    // For this version, all users access all Admin-defined playlists merged.
    
    db.all("SELECT * FROM playlists", [], async (err, playlists) => {
        if (err) return res.status(500).json({ error: "Db Error" });

        let mergedContent = "";

        for (const pl of playlists) {
            try {
                if (pl.type === 'url' && pl.source_url) {
                    // Fetch fresh content from provider
                    const response = await axios.get(pl.source_url);
                    mergedContent += response.data + "\n";
                } else if (pl.type === 'file' && pl.content) {
                    mergedContent += pl.content + "\n";
                }
            } catch (e) {
                console.error(`Error fetching playlist ${pl.name}:`, e.message);
            }
        }
        
        // Return raw M3U text so the Frontend parser can parse it
        res.setHeader('Content-Type', 'audio/x-mpegurl');
        res.send(mergedContent);
    });
});


// --- SERVE REACT APP (Production) ---
const distPath = join(__dirname, '../dist');
if (fs.existsSync(distPath)) {
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
        res.sendFile(join(distPath, 'index.html'));
    });
}

app.listen(PORT, () => {
    console.log(`Xtream VPS Server running on port ${PORT}`);
});