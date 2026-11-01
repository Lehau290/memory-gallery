/**
 * MEMORY GALLERY – Node.js Express Server
 * "Your memories, forever in one place."
 */

const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

const authRoutes = require('./routes/auth');
const memoriesRoutes = require('./routes/memories');
const albumsRoutes = require('./routes/albums');
const timelineRoutes = require('./routes/timeline');
const onThisDayRoutes = require('./routes/onThisDay');
const statsRoutes = require('./routes/stats');
const downloadRoutes = require('./routes/download');
const streamRoutes = require('./routes/stream');
const adminRoutes = require('./routes/admin');

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Ensure upload folders exist
const uploadDirs = ['uploads/photos', 'uploads/videos', 'uploads/avatars'];
uploadDirs.forEach(dir => {
    const p = path.join(__dirname, dir);
    if (!fs.existsSync(p)) {
        fs.mkdirSync(p, { recursive: true });
    }
});

// Static files
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
app.use('/assets', express.static(path.join(__dirname, 'assets')));

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/memories', memoriesRoutes);
app.use('/api/albums', albumsRoutes);
app.use('/api/timeline', timelineRoutes);
app.use('/api/on-this-day', onThisDayRoutes);
app.use('/api/stats', statsRoutes);
app.use('/api/download', downloadRoutes);
app.use('/api/stream', streamRoutes);
app.use('/api/admin', adminRoutes);

// Compatibility fallback for .php query endpoints (so old and new API calls both work seamlessly)
app.all('/api/:file.php', (req, res, next) => {
    const file = req.params.file;
    const action = req.query.action || (req.method === 'POST' ? 'create' : 'list');

    if (file === 'auth') {
        req.url = `/${action}`;
        return authRoutes(req, res, next);
    }
    if (file === 'memories') {
        if (action === 'list') req.url = '/';
        else if (action === 'get') req.url = `/${req.query.id}`;
        else if (action === 'create' || action === 'upload') req.url = '/';
        else if (action === 'update') req.url = '/update';
        else if (action === 'toggle_favorite') req.url = '/toggle_favorite';
        else if (action === 'delete') req.url = '/delete';
        else if (action === 'batch') req.url = '/batch';
        return memoriesRoutes(req, res, next);
    }
    if (file === 'albums') {
        if (action === 'list') req.url = '/';
        else if (action === 'get') req.url = `/${req.query.id}`;
        else if (action === 'create') req.url = '/';
        else if (action === 'update') req.url = '/update';
        else if (action === 'delete') req.url = '/delete';
        return albumsRoutes(req, res, next);
    }
    if (file === 'timeline') {
        req.url = '/';
        return timelineRoutes(req, res, next);
    }
    if (file === 'on-this-day') {
        req.url = '/';
        return onThisDayRoutes(req, res, next);
    }
    if (file === 'stats') {
        req.url = '/';
        return statsRoutes(req, res, next);
    }
    if (file === 'download') {
        req.url = '/';
        return downloadRoutes(req, res, next);
    }
    if (file === 'stream') {
        req.url = '/';
        return streamRoutes(req, res, next);
    }
    if (file === 'admin') {
        req.url = `/${action}`;
        return adminRoutes(req, res, next);
    }
    next();
});

// Serve frontend SPA
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// Start Server
app.listen(PORT, () => {
    console.log(`
======================================================
  ✨ MEMORY GALLERY – Node.js Server is Running! ✨
  🚀 Slogan: "Your memories, forever in one place."
------------------------------------------------------
  🌐 Local URL: http://localhost:${PORT}
  📁 Storage:   ./uploads/
  📦 Database:  ./database/memory_gallery.sqlite
======================================================
    `);
});

