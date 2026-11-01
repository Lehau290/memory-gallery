/**
 * MEMORY GALLERY - Download Router (Node.js)
 */

const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const archiver = require('archiver');
const https = require('https');
const http = require('http');

const db = require('../config/db');
const { requireAuth } = require('../middleware/auth');

// GET /api/download (Single or Batch)
router.get('/', requireAuth, async (req, res) => {
    try {
        const id = req.query.id ? parseInt(req.query.id) : 0;
        const idsStr = req.query.ids || '';

        // Single file
        if (id > 0) {
            const memory = await db.getAsync(
                'SELECT title, file_path, file_name, mime_type FROM memories WHERE id = ? AND user_id = ?',
                [id, req.user.id]
            );

            if (!memory) {
                return res.status(404).send('Không tìm thấy tệp kỷ niệm.');
            }

            if (memory.file_path.startsWith('http://') || memory.file_path.startsWith('https://')) {
                return res.redirect(memory.file_path);
            }

            const localPath = path.join(__dirname, '..', memory.file_path);
            if (!fs.existsSync(localPath)) {
                return res.status(404).send('Tệp không tồn tại trên máy chủ.');
            }

            return res.download(localPath, memory.file_name || path.basename(localPath));
        }

        // Batch zip
        if (idsStr) {
            const ids = idsStr.split(',').map(x => parseInt(x)).filter(Boolean);
            if (ids.length === 0) {
                return res.status(400).send('Vui lòng chọn các kỷ niệm hợp lệ.');
            }

            const placeholders = ids.map(() => '?').join(',');
            const items = await db.allAsync(
                `SELECT id, title, file_path, file_name FROM memories WHERE user_id = ? AND id IN (${placeholders})`,
                [req.user.id, ...ids]
            );

            if (items.length === 0) {
                return res.status(404).send('Không tìm thấy kỷ niệm.');
            }

            const archive = archiver('zip', { zlib: { level: 9 } });
            const zipName = `MemoryGallery_${Date.now()}.zip`;

            res.attachment(zipName);
            archive.pipe(res);

            for (const item of items) {
                if (item.file_path.startsWith('uploads/')) {
                    const localPath = path.join(__dirname, '..', item.file_path);
                    if (fs.existsSync(localPath)) {
                        archive.file(localPath, { name: item.file_name || path.basename(localPath) });
                    }
                }
            }

            await archive.finalize();
            return;
        }

        res.status(400).send('Tham số không hợp lệ.');
    } catch (e) {
        res.status(500).send(e.message);
    }
});

module.exports = router;

