/**
 * MEMORY GALLERY - Video Streaming Router (Node.js)
 * Supports HTTP 206 Partial Content (Byte Range) for smooth seeking
 */

const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');

const db = require('../config/db');
const { requireAuth } = require('../middleware/auth');

// GET /api/stream/:id or /api/stream?id=...
router.get(['/', '/:id'], requireAuth, async (req, res) => {
    try {
        const id = parseInt(req.params.id || req.query.id);
        const video = await db.getAsync(
            'SELECT file_path, mime_type, file_size FROM memories WHERE id = ? AND user_id = ?',
            [id, req.user.id]
        );

        if (!video) {
            return res.status(404).send('Không tìm thấy video.');
        }

        if (video.file_path.startsWith('http://') || video.file_path.startsWith('https://')) {
            return res.redirect(video.file_path);
        }

        const localPath = path.join(__dirname, '..', video.file_path);
        if (!fs.existsSync(localPath)) {
            return res.status(404).send('Tệp video không tồn tại.');
        }

        const stat = fs.statSync(localPath);
        const fileSize = stat.size;
        const range = req.headers.range;

        if (range) {
            const parts = range.replace(/bytes=/, '').split('-');
            const start = parseInt(parts[0], 10);
            const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
            const chunksize = (end - start) + 1;
            const file = fs.createReadStream(localPath, { start, end });
            const head = {
                'Content-Range': `bytes ${start}-${end}/${fileSize}`,
                'Accept-Ranges': 'bytes',
                'Content-Length': chunksize,
                'Content-Type': video.mime_type || 'video/mp4',
            };
            res.writeHead(206, head);
            file.pipe(res);
        } else {
            const head = {
                'Content-Length': fileSize,
                'Content-Type': video.mime_type || 'video/mp4',
            };
            res.writeHead(200, head);
            fs.createReadStream(localPath).pipe(res);
        }
    } catch (e) {
        res.status(500).send(e.message);
    }
});

module.exports = router;

