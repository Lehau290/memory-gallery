/**
 * MEMORY GALLERY - Admin Dashboard Router (Node.js)
 */

const express = require('express');
const router = express.Router();
const db = require('../config/db');
const { requireAdmin, formatBytes, logActivity } = require('../middleware/auth');

// GET /api/admin/overview
router.get(['/', '/overview'], requireAdmin, async (req, res) => {
    try {
        const totalUsersRow = await db.getAsync('SELECT COUNT(*) as count FROM users');
        const activeUsersRow = await db.getAsync("SELECT COUNT(*) as count FROM users WHERE status = 'active'");
        const suspendedUsersRow = await db.getAsync("SELECT COUNT(*) as count FROM users WHERE status = 'suspended'");

        const totalPhotosRow = await db.getAsync("SELECT COUNT(*) as count FROM memories WHERE file_type = 'image'");
        const totalVideosRow = await db.getAsync("SELECT COUNT(*) as count FROM memories WHERE file_type = 'video'");
        const totalAlbumsRow = await db.getAsync('SELECT COUNT(*) as count FROM albums');

        const totalStorageRow = await db.getAsync('SELECT COALESCE(SUM(file_size), 0) as total FROM memories');
        const totalStorage = totalStorageRow ? totalStorageRow.total : 0;

        const uploadTrends = await db.allAsync(`
            SELECT strftime('%Y-%m', created_at) as month, COUNT(*) as uploads_count, SUM(file_size) as bytes 
            FROM memories 
            GROUP BY month 
            ORDER BY month DESC LIMIT 6
        `);

        const recentLogs = await db.allAsync(`
            SELECT l.*, u.username, u.full_name 
            FROM activity_logs l 
            LEFT JOIN users u ON l.user_id = u.id 
            ORDER BY l.id DESC LIMIT 10
        `);

        res.json({
            stats: {
                total_users: totalUsersRow ? totalUsersRow.count : 0,
                active_users: activeUsersRow ? activeUsersRow.count : 0,
                suspended_users: suspendedUsersRow ? suspendedUsersRow.count : 0,
                total_photos: totalPhotosRow ? totalPhotosRow.count : 0,
                total_videos: totalVideosRow ? totalVideosRow.count : 0,
                total_albums: totalAlbumsRow ? totalAlbumsRow.count : 0,
                total_storage: totalStorage,
                formatted_storage: formatBytes(totalStorage)
            },
            upload_trends: uploadTrends.reverse(),
            recent_logs: recentLogs
        });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// GET /api/admin/users
router.get('/users', requireAdmin, async (req, res) => {
    try {
        const search = (req.query.search || '').trim();
        const status = (req.query.status || '').trim();

        const where = ['1=1'];
        const params = [];

        if (search) {
            where.push('(username LIKE ? OR email LIKE ? OR full_name LIKE ?)');
            const term = `%${search}%`;
            params.push(term, term, term);
        }

        if (status) {
            where.push('status = ?');
            params.push(status);
        }

        const sql = `
            SELECT u.id, u.username, u.email, u.full_name, u.avatar_url, u.role, u.status, u.storage_quota, u.used_storage, u.created_at,
            (SELECT COUNT(*) FROM memories WHERE user_id = u.id) as memory_count,
            (SELECT COUNT(*) FROM albums WHERE user_id = u.id) as album_count
            FROM users u 
            WHERE ${where.join(' AND ')} 
            ORDER BY u.id ASC
        `;

        const users = await db.allAsync(sql, params);
        for (const u of users) {
            u.formatted_used_storage = formatBytes(u.used_storage);
            u.formatted_quota = formatBytes(u.storage_quota);
        }

        res.json({ users });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// POST /api/admin/toggle_user_status
router.post('/toggle_user_status', requireAdmin, async (req, res) => {
    try {
        const targetUserId = parseInt(req.body.user_id);
        if (targetUserId === req.user.id) {
            return res.status(400).json({ error: 'Bạn không thể tự khóa tài khoản quản trị của chính mình.' });
        }

        const target = await db.getAsync('SELECT status, username FROM users WHERE id = ?', [targetUserId]);
        if (!target) {
            return res.status(404).json({ error: 'Không tìm thấy người dùng.' });
        }

        const newStatus = target.status === 'active' ? 'suspended' : 'active';
        await db.runAsync('UPDATE users SET status = ? WHERE id = ?', [newStatus, targetUserId]);

        const actionText = newStatus === 'active' ? 'Mở khóa' : 'Khóa';
        await logActivity(req.user.id, 'ADMIN_TOGGLE_STATUS', `${actionText} tài khoản: ${target.username}`, req.ip);

        res.json({
            message: `Đã ${actionText} tài khoản thành công!`,
            new_status: newStatus
        });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// GET /api/admin/storage
router.get('/storage', requireAdmin, async (req, res) => {
    try {
        const breakdown = await db.allAsync(`
            SELECT file_type, mime_type, COUNT(*) as count, SUM(file_size) as total_size 
            FROM memories 
            GROUP BY file_type, mime_type
        `);
        for (const b of breakdown) {
            b.formatted_size = formatBytes(b.total_size);
        }

        const largeFiles = await db.allAsync(`
            SELECT m.id, m.title, m.file_name, m.file_path, m.file_type, m.file_size, m.created_at, u.username 
            FROM memories m 
            JOIN users u ON m.user_id = u.id 
            ORDER BY m.file_size DESC LIMIT 15
        `);
        for (const lf of largeFiles) {
            lf.formatted_size = formatBytes(lf.file_size);
        }

        res.json({ breakdown, largest_files: largeFiles });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// GET /api/admin/logs
router.get('/logs', requireAdmin, async (req, res) => {
    try {
        const logs = await db.allAsync(`
            SELECT l.*, u.username, u.full_name 
            FROM activity_logs l 
            LEFT JOIN users u ON l.user_id = u.id 
            ORDER BY l.id DESC LIMIT 50
        `);
        res.json({ logs });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

module.exports = router;

