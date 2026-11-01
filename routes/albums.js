/**
 * MEMORY GALLERY - Albums Router (Node.js)
 */

const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const db = require('../config/db');
const { requireAuth, formatBytes, logActivity } = require('../middleware/auth');

const coverStorage = multer.diskStorage({
    destination: (req, file, cb) => {
        const dest = path.join(__dirname, '..', 'uploads', 'photos');
        if (!fs.existsSync(dest)) fs.mkdirSync(dest, { recursive: true });
        cb(null, dest);
    },
    filename: (req, file, cb) => {
        const ext = path.extname(file.originalname);
        cb(null, `album_cover_${Date.now()}_${Math.random().toString(36).substring(7)}${ext}`);
    }
});
const uploadCover = multer({ storage: coverStorage, limits: { fileSize: 10 * 1024 * 1024 } });

// GET /api/albums (List)
router.get('/', requireAuth, async (req, res) => {
    try {
        const search = (req.query.search || '').trim();
        const category = (req.query.category || '').trim();

        const where = ['a.user_id = ?'];
        const params = [req.user.id];

        if (search) {
            where.push('(a.title LIKE ? OR a.description LIKE ?)');
            params.push(`%${search}%`, `%${search}%`);
        }

        if (category && category !== 'all') {
            where.push('a.category = ?');
            params.push(category);
        }

        const sql = `
            SELECT a.*, 
            COUNT(m.id) as total_items,
            SUM(CASE WHEN m.file_type = 'image' THEN 1 ELSE 0 END) as total_photos,
            SUM(CASE WHEN m.file_type = 'video' THEN 1 ELSE 0 END) as total_videos,
            (SELECT file_path FROM memories WHERE album_id = a.id ORDER BY memory_date DESC LIMIT 1) as latest_photo
            FROM albums a 
            LEFT JOIN memories m ON a.id = m.album_id AND m.user_id = a.user_id
            WHERE ${where.join(' AND ')} 
            GROUP BY a.id 
            ORDER BY a.created_at DESC
        `;

        const albums = await db.allAsync(sql, params);

        for (const alb of albums) {
            alb.total_items = alb.total_items || 0;
            alb.total_photos = alb.total_photos || 0;
            alb.total_videos = alb.total_videos || 0;
            if (!alb.cover_url) {
                alb.cover_url = alb.latest_photo || 'https://images.unsplash.com/photo-1506744038136-46273834b3fb?w=800&auto=format&fit=crop&q=80';
            }
        }

        res.json({
            count: albums.length,
            albums
        });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// GET /api/albums/:id
router.get('/:id', requireAuth, async (req, res) => {
    try {
        const id = parseInt(req.params.id);
        const album = await db.getAsync(`
            SELECT a.*, 
            COUNT(m.id) as total_items,
            SUM(CASE WHEN m.file_type = 'image' THEN 1 ELSE 0 END) as total_photos,
            SUM(CASE WHEN m.file_type = 'video' THEN 1 ELSE 0 END) as total_videos
            FROM albums a 
            LEFT JOIN memories m ON a.id = m.album_id
            WHERE a.id = ? AND a.user_id = ?
            GROUP BY a.id
        `, [id, req.user.id]);

        if (!album) {
            return res.status(404).json({ error: 'Không tìm thấy album này.' });
        }

        const memories = await db.allAsync(`
            SELECT * FROM memories WHERE album_id = ? AND user_id = ? ORDER BY memory_date DESC
        `, [id, req.user.id]);

        for (const m of memories) {
            m.formatted_size = formatBytes(m.file_size);
        }

        album.memories = memories;
        res.json({ album });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// POST /api/albums (Create)
router.post('/', requireAuth, uploadCover.single('cover_file'), async (req, res) => {
    try {
        const title = (req.body.title || '').trim();
        const description = (req.body.description || '').trim();
        const category = (req.body.category || 'Gia đình').trim();
        let coverUrl = req.body.cover_url || '';

        if (!title) {
            return res.status(422).json({ error: 'Vui lòng nhập tên album.' });
        }

        if (req.file) {
            coverUrl = `uploads/photos/${req.file.filename}`;
        }
        if (!coverUrl) {
            coverUrl = 'https://images.unsplash.com/photo-1506744038136-46273834b3fb?w=800&auto=format&fit=crop&q=80';
        }

        const ins = await db.runAsync(
            'INSERT INTO albums (user_id, title, description, cover_url, category) VALUES (?, ?, ?, ?, ?)',
            [req.user.id, title, description, coverUrl, category]
        );
        const albumId = ins.lastID;

        // If memories provided to assign
        if (req.body.memory_ids && Array.isArray(req.body.memory_ids)) {
            const mIds = req.body.memory_ids.map(x => parseInt(x));
            const ph = mIds.map(() => '?').join(',');
            await db.runAsync(
                `UPDATE memories SET album_id = ? WHERE user_id = ? AND id IN (${ph})`,
                [albumId, req.user.id, ...mIds]
            );
        }

        await logActivity(req.user.id, 'CREATE_ALBUM', `Tạo album mới: ${title}`, req.ip);

        res.status(201).json({
            message: 'Tạo album thành công!',
            album_id: albumId
        });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// POST /api/albums/update or PUT /:id
router.post(['/update', '/:id/update'], requireAuth, uploadCover.single('cover_file'), async (req, res) => {
    try {
        const id = parseInt(req.body.id || req.params.id);
        const title = (req.body.title || '').trim();
        const description = (req.body.description || '').trim();
        const category = (req.body.category || '').trim();

        if (!title) {
            return res.status(422).json({ error: 'Vui lòng nhập tên album.' });
        }

        const existing = await db.getAsync('SELECT id FROM albums WHERE id = ? AND user_id = ?', [id, req.user.id]);
        if (!existing) {
            return res.status(404).json({ error: 'Không tìm thấy album để cập nhật.' });
        }

        let coverUrl = req.body.cover_url || '';
        if (req.file) {
            coverUrl = `uploads/photos/${req.file.filename}`;
        }

        const updates = ['title = ?', 'description = ?', 'category = ?', 'updated_at = CURRENT_TIMESTAMP'];
        const params = [title, description, category];

        if (coverUrl) {
            updates.push('cover_url = ?');
            params.push(coverUrl);
        }
        params.push(id, req.user.id);

        await db.runAsync(`UPDATE albums SET ${updates.join(', ')} WHERE id = ? AND user_id = ?`, params);
        await logActivity(req.user.id, 'UPDATE_ALBUM', `Cập nhật album #${id}: ${title}`, req.ip);

        res.json({ message: 'Cập nhật album thành công!' });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// POST /api/albums/delete or DELETE /:id
router.post(['/delete', '/:id/delete'], requireAuth, async (req, res) => {
    try {
        const id = parseInt(req.body.id || req.params.id);
        const row = await db.getAsync('SELECT title FROM albums WHERE id = ? AND user_id = ?', [id, req.user.id]);

        if (!row) {
            return res.status(404).json({ error: 'Không tìm thấy album để xóa.' });
        }

        // Unlink memories without deleting original media
        await db.runAsync('UPDATE memories SET album_id = NULL WHERE album_id = ? AND user_id = ?', [id, req.user.id]);
        await db.runAsync('DELETE FROM albums WHERE id = ? AND user_id = ?', [id, req.user.id]);

        await logActivity(req.user.id, 'DELETE_ALBUM', `Đã xóa album: ${row.title}`, req.ip);

        res.json({ message: 'Đã xóa album thành công (các hình ảnh và video vẫn được giữ an toàn trong thư viện)!' });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

module.exports = router;

