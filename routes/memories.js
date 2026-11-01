/**
 * MEMORY GALLERY - Memories Router (Node.js)
 */

const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const db = require('../config/db');
const { requireAuth, formatBytes, logActivity, updateUserStorage } = require('../middleware/auth');

// Multer storage for photos and videos
const mediaStorage = multer.diskStorage({
    destination: (req, file, cb) => {
        const isVideo = file.mimetype.startsWith('video/');
        const dest = path.join(__dirname, '..', 'uploads', isVideo ? 'videos' : 'photos');
        if (!fs.existsSync(dest)) fs.mkdirSync(dest, { recursive: true });
        cb(null, dest);
    },
    filename: (req, file, cb) => {
        const ext = path.extname(file.originalname);
        const uniqueName = `mem_${Date.now()}_${Math.random().toString(36).substring(2, 9)}${ext}`;
        cb(null, uniqueName);
    }
});

const uploadMedia = multer({
    storage: mediaStorage,
    limits: { fileSize: 100 * 1024 * 1024 } // 100MB
});

async function saveTagsForMemory(userId, memoryId, tags = [], replace = false) {
    if (replace) {
        await db.runAsync('DELETE FROM memory_tags WHERE memory_id = ?', [memoryId]);
    }
    if (!tags || tags.length === 0) return;

    for (let tagName of tags) {
        tagName = tagName.trim();
        if (!tagName) continue;

        let tag = await db.getAsync('SELECT id FROM tags WHERE user_id = ? AND name = ?', [userId, tagName]);
        let tagId;
        if (!tag) {
            const ins = await db.runAsync('INSERT INTO tags (user_id, name) VALUES (?, ?)', [userId, tagName]);
            tagId = ins.lastID;
        } else {
            tagId = tag.id;
        }

        await db.runAsync('INSERT OR IGNORE INTO memory_tags (memory_id, tag_id) VALUES (?, ?)', [memoryId, tagId]);
    }
}

// GET /api/memories (List)
router.get('/', requireAuth, async (req, res) => {
    try {
        const search = (req.query.search || '').trim();
        const type = (req.query.type || 'all').trim();
        const albumId = req.query.album_id ? parseInt(req.query.album_id) : null;
        const isFavorite = req.query.favorite !== undefined && req.query.favorite !== '' ? parseInt(req.query.favorite) : null;
        const year = req.query.year ? parseInt(req.query.year) : null;
        const sort = req.query.sort || 'memory_date_desc';

        const where = ['m.user_id = ?'];
        const params = [req.user.id];

        if (type === 'image' || type === 'video') {
            where.push('m.file_type = ?');
            params.push(type);
        }

        if (albumId !== null) {
            where.push('m.album_id = ?');
            params.push(albumId);
        }

        if (isFavorite !== null) {
            where.push('m.is_favorite = ?');
            params.push(isFavorite);
        }

        if (year !== null) {
            where.push("(strftime('%Y', m.memory_date) = ? OR m.memory_date LIKE ?)");
            params.push(String(year));
            params.push(`${year}-%`);
        }

        if (search) {
            const term = `%${search}%`;
            where.push(`(
                m.title LIKE ? OR m.description LIKE ? OR m.location LIKE ? OR a.title LIKE ? OR EXISTS (
                    SELECT 1 FROM memory_tags mt 
                    JOIN tags t ON mt.tag_id = t.id 
                    WHERE mt.memory_id = m.id AND t.name LIKE ?
                )
            )`);
            params.push(term, term, term, term, term);
        }

        let orderBy = 'm.memory_date DESC, m.id DESC';
        if (sort === 'memory_date_asc') orderBy = 'm.memory_date ASC, m.id ASC';
        else if (sort === 'created_at_desc') orderBy = 'm.created_at DESC';
        else if (sort === 'title_asc') orderBy = 'm.title ASC';

        const sql = `
            SELECT m.*, a.title as album_title 
            FROM memories m 
            LEFT JOIN albums a ON m.album_id = a.id 
            WHERE ${where.join(' AND ')} 
            ORDER BY ${orderBy}
        `;

        const memories = await db.allAsync(sql, params);

        // Fetch tags for these memories
        if (memories.length > 0) {
            const ids = memories.map(m => m.id);
            const placeholders = ids.map(() => '?').join(',');
            const tagsRows = await db.allAsync(`
                SELECT mt.memory_id, t.id as tag_id, t.name as tag_name 
                FROM memory_tags mt 
                JOIN tags t ON mt.tag_id = t.id 
                WHERE mt.memory_id IN (${placeholders})
            `, ids);

            const tagsMap = {};
            for (const r of tagsRows) {
                if (!tagsMap[r.memory_id]) tagsMap[r.memory_id] = [];
                tagsMap[r.memory_id].push({ id: r.tag_id, name: r.tag_name });
            }

            for (const m of memories) {
                m.tags = tagsMap[m.id] || [];
                m.formatted_size = formatBytes(m.file_size);
            }
        }

        res.json({
            count: memories.length,
            memories
        });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// GET /api/memories/:id
router.get('/:id', requireAuth, async (req, res) => {
    try {
        const id = parseInt(req.params.id);
        const memory = await db.getAsync(`
            SELECT m.*, a.title as album_title 
            FROM memories m 
            LEFT JOIN albums a ON m.album_id = a.id 
            WHERE m.id = ? AND m.user_id = ?
        `, [id, req.user.id]);

        if (!memory) {
            return res.status(404).json({ error: 'Không tìm thấy kỷ niệm này.' });
        }

        const tags = await db.allAsync(`
            SELECT t.id, t.name FROM memory_tags mt JOIN tags t ON mt.tag_id = t.id WHERE mt.memory_id = ?
        `, [id]);

        memory.tags = tags;
        memory.formatted_size = formatBytes(memory.file_size);

        res.json({ memory });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// POST /api/memories (Upload Multi-file)
router.post(['/', '/upload'], requireAuth, uploadMedia.array('files[]'), async (req, res) => {
    try {
        const titlePrefix = (req.body.title || '').trim();
        const description = (req.body.description || '').trim();
        const memoryDate = req.body.memory_date || new Date().toISOString().split('T')[0];
        const location = (req.body.location || '').trim();
        const albumId = req.body.album_id ? parseInt(req.body.album_id) : null;
        const privacy = req.body.privacy === 'shared' ? 'shared' : 'private';
        const tagsRaw = req.body.tags || '';

        let tagNames = [];
        if (tagsRaw) {
            tagNames = tagsRaw.split(',').map(t => t.trim()).filter(Boolean);
        }

        const files = req.files || [];
        if (files.length === 0) {
            // Check if file_url provided
            const fileUrl = (req.body.file_url || '').trim();
            if (fileUrl) {
                const isVideo = fileUrl.endsWith('.mp4') || fileUrl.endsWith('.webm');
                const title = titlePrefix || 'Kỷ niệm mới';
                const fileType = isVideo ? 'video' : 'image';
                const mimeType = isVideo ? 'video/mp4' : 'image/jpeg';
                const fileSize = 3 * 1024 * 1024;

                const ins = await db.runAsync(`
                    INSERT INTO memories (user_id, album_id, title, description, file_path, file_name, file_type, mime_type, file_size, memory_date, location, is_favorite, privacy)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?)
                `, [req.user.id, albumId, title, description, fileUrl, path.basename(fileUrl), fileType, mimeType, fileSize, memoryDate, location, privacy]);

                await saveTagsForMemory(req.user.id, ins.lastID, tagNames);
                await updateUserStorage(req.user.id);
                await logActivity(req.user.id, 'UPLOAD_URL', `Thêm kỷ niệm từ URL: ${title}`, req.ip);

                return res.status(201).json({
                    message: 'Đã lưu kỷ niệm thành công!',
                    memory_id: ins.lastID
                });
            }
            return res.status(422).json({ error: 'Vui lòng chọn ít nhất một hình ảnh hoặc video để tải lên.' });
        }

        const uploadedResults = [];
        for (let i = 0; i < files.length; i++) {
            const file = files[i];
            const isVideo = file.mimetype.startsWith('video/');
            const fileType = isVideo ? 'video' : 'image';
            const relativePath = `uploads/${isVideo ? 'videos' : 'photos'}/${file.filename}`;

            let memTitle;
            if (titlePrefix) {
                memTitle = files.length > 1 ? `${titlePrefix} (${i + 1})` : titlePrefix;
            } else {
                const baseName = path.parse(file.originalname).name;
                memTitle = baseName.replace(/[-_]/g, ' ');
            }

            const ins = await db.runAsync(`
                INSERT INTO memories (user_id, album_id, title, description, file_path, file_name, file_type, mime_type, file_size, memory_date, location, is_favorite, privacy)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?)
            `, [
                req.user.id,
                albumId,
                memTitle,
                description,
                relativePath,
                file.originalname,
                fileType,
                file.mimetype,
                file.size,
                memoryDate,
                location,
                privacy
            ]);

            await saveTagsForMemory(req.user.id, ins.lastID, tagNames);
            uploadedResults.push({
                id: ins.lastID,
                title: memTitle,
                file_path: relativePath,
                file_type: fileType
            });
        }

        await updateUserStorage(req.user.id);
        await logActivity(req.user.id, 'UPLOAD', `Đã tải lên ${uploadedResults.length} file kỷ niệm`, req.ip);

        res.status(201).json({
            message: `Tải lên thành công ${uploadedResults.length} kỷ niệm!`,
            uploaded: uploadedResults
        });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// POST /api/memories/update or PUT /:id
router.post(['/update', '/:id/update'], requireAuth, async (req, res) => {
    try {
        const id = parseInt(req.body.id || req.params.id);
        const { title, description, memory_date, location, privacy } = req.body;
        const album_id = req.body.album_id ? parseInt(req.body.album_id) : null;

        if (!title) {
            return res.status(422).json({ error: 'Tên kỷ niệm không được để trống.' });
        }

        const existing = await db.getAsync('SELECT id FROM memories WHERE id = ? AND user_id = ?', [id, req.user.id]);
        if (!existing) {
            return res.status(404).json({ error: 'Không tìm thấy kỷ niệm.' });
        }

        await db.runAsync(`
            UPDATE memories SET title = ?, description = ?, memory_date = ?, location = ?, album_id = ?, privacy = ?, updated_at = CURRENT_TIMESTAMP
            WHERE id = ? AND user_id = ?
        `, [title, description || '', memory_date, location || '', album_id, privacy || 'private', id, req.user.id]);

        if (req.body.tags !== undefined) {
            const tags = typeof req.body.tags === 'string' ? req.body.tags.split(',').map(t => t.trim()) : req.body.tags;
            await saveTagsForMemory(req.user.id, id, tags, true);
        }

        await logActivity(req.user.id, 'UPDATE_MEMORY', `Cập nhật thông tin kỷ niệm #${id}: ${title}`, req.ip);

        res.json({ message: 'Cập nhật thông tin kỷ niệm thành công!' });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// POST /api/memories/toggle_favorite
router.post(['/toggle_favorite', '/:id/favorite'], requireAuth, async (req, res) => {
    try {
        const id = parseInt(req.body.id || req.params.id);
        const row = await db.getAsync('SELECT is_favorite, title FROM memories WHERE id = ? AND user_id = ?', [id, req.user.id]);

        if (!row) {
            return res.status(404).json({ error: 'Không tìm thấy kỷ niệm.' });
        }

        const newFav = row.is_favorite ? 0 : 1;
        await db.runAsync('UPDATE memories SET is_favorite = ? WHERE id = ? AND user_id = ?', [newFav, id, req.user.id]);

        res.json({
            message: newFav ? 'Đã thêm vào mục yêu thích!' : 'Đã xóa khỏi mục yêu thích.',
            is_favorite: newFav
        });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// POST /api/memories/delete or DELETE /:id
router.post(['/delete', '/:id/delete'], requireAuth, async (req, res) => {
    try {
        const id = parseInt(req.body.id || req.params.id);
        const row = await db.getAsync('SELECT file_path, title FROM memories WHERE id = ? AND user_id = ?', [id, req.user.id]);

        if (!row) {
            return res.status(404).json({ error: 'Không tìm thấy kỷ niệm để xóa.' });
        }

        // Delete local file
        if (row.file_path && row.file_path.startsWith('uploads/')) {
            const diskPath = path.join(__dirname, '..', row.file_path);
            if (fs.existsSync(diskPath)) {
                try { fs.unlinkSync(diskPath); } catch (e) {}
            }
        }

        await db.runAsync('DELETE FROM memories WHERE id = ? AND user_id = ?', [id, req.user.id]);
        await updateUserStorage(req.user.id);
        await logActivity(req.user.id, 'DELETE_MEMORY', `Đã xóa kỷ niệm: ${row.title}`, req.ip);

        res.json({ message: 'Đã xóa kỷ niệm thành công!' });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// POST /api/memories/batch
router.post('/batch', requireAuth, async (req, res) => {
    try {
        const { operation, ids, album_id } = req.body;
        if (!ids || !Array.isArray(ids) || ids.length === 0) {
            return res.status(422).json({ error: 'Vui lòng chọn ít nhất một kỷ niệm.' });
        }

        const cleanIds = ids.map(x => parseInt(x));
        const placeholders = cleanIds.map(() => '?').join(',');

        if (operation === 'delete') {
            const toDelete = await db.allAsync(
                `SELECT id, file_path FROM memories WHERE user_id = ? AND id IN (${placeholders})`,
                [req.user.id, ...cleanIds]
            );

            for (const item of toDelete) {
                if (item.file_path && item.file_path.startsWith('uploads/')) {
                    const p = path.join(__dirname, '..', item.file_path);
                    if (fs.existsSync(p)) {
                        try { fs.unlinkSync(p); } catch (e) {}
                    }
                }
            }

            await db.runAsync(
                `DELETE FROM memories WHERE user_id = ? AND id IN (${placeholders})`,
                [req.user.id, ...cleanIds]
            );
            await updateUserStorage(req.user.id);
            await logActivity(req.user.id, 'BATCH_DELETE', `Xóa hàng loạt ${toDelete.length} kỷ niệm`, req.ip);

            return res.json({ message: 'Đã xóa các kỷ niệm đã chọn!' });
        } else if (operation === 'add_to_album') {
            const targetAlbum = album_id ? parseInt(album_id) : null;
            await db.runAsync(
                `UPDATE memories SET album_id = ? WHERE user_id = ? AND id IN (${placeholders})`,
                [targetAlbum, req.user.id, ...cleanIds]
            );
            return res.json({ message: 'Đã chuyển các kỷ niệm vào album!' });
        }

        res.status(400).json({ error: 'Thao tác không được hỗ trợ.' });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

module.exports = router;

