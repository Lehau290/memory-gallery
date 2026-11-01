/**
 * MEMORY GALLERY - Stats Router (Node.js)
 */

const express = require('express');
const router = express.Router();
const db = require('../config/db');
const { requireAuth, formatBytes, updateUserStorage } = require('../middleware/auth');

// GET /api/stats
router.get('/', requireAuth, async (req, res) => {
    try {
        const counts = await db.getAsync(`
            SELECT 
            COUNT(*) as total_items,
            SUM(CASE WHEN file_type = 'image' THEN 1 ELSE 0 END) as total_photos,
            SUM(CASE WHEN file_type = 'video' THEN 1 ELSE 0 END) as total_videos,
            SUM(CASE WHEN is_favorite = 1 THEN 1 ELSE 0 END) as total_favorites,
            COALESCE(SUM(file_size), 0) as used_bytes
            FROM memories WHERE user_id = ?
        `, [req.user.id]);

        const albumRow = await db.getAsync('SELECT COUNT(*) as count FROM albums WHERE user_id = ?', [req.user.id]);
        const totalAlbums = albumRow ? albumRow.count : 0;

        const usedBytes = counts ? (counts.used_bytes || 0) : 0;
        const quotaBytes = req.user.storage_quota || 21474836480; // 20GB
        const usedPercent = quotaBytes > 0 ? Math.round((usedBytes / quotaBytes) * 1000) / 10 : 0;

        await updateUserStorage(req.user.id);

        // On this day count
        const now = new Date();
        const mm = String(now.getMonth() + 1).padStart(2, '0');
        const dd = String(now.getDate()).padStart(2, '0');
        const todayMD = `${mm}-${dd}`;
        const currentY = String(now.getFullYear());

        const otdRow = await db.getAsync(`
            SELECT COUNT(*) as count FROM memories 
            WHERE user_id = ? 
            AND (strftime('%m-%d', memory_date) = ? OR strftime('%m-%d', created_at) = ?)
            AND (strftime('%Y', memory_date) < ? OR strftime('%Y', created_at) < ?)
        `, [req.user.id, todayMD, todayMD, currentY, currentY]);
        const onThisDayCount = otdRow ? otdRow.count : 0;

        // Recent memories
        const recentMemories = await db.allAsync(`
            SELECT id, title, description, file_path, file_type, memory_date, is_favorite, location 
            FROM memories 
            WHERE user_id = ? 
            ORDER BY created_at DESC, id DESC LIMIT 8
        `, [req.user.id]);

        // Recent albums
        const recentAlbums = await db.allAsync(`
            SELECT a.*, COUNT(m.id) as items_count 
            FROM albums a 
            LEFT JOIN memories m ON a.id = m.album_id 
            WHERE a.user_id = ? 
            GROUP BY a.id 
            ORDER BY a.created_at DESC LIMIT 4
        `, [req.user.id]);

        // Time of day greeting in Vietnamese
        const hour = now.getHours();
        let greeting, subGreeting;
        if (hour >= 5 && hour < 12) {
            greeting = 'Chào buổi sáng!';
            subGreeting = 'Khởi đầu ngày mới tràn đầy năng lượng cùng những kỷ niệm đẹp.';
        } else if (hour >= 12 && hour < 18) {
            greeting = 'Chào buổi chiều!';
            subGreeting = 'Dành một chút thời gian thư giãn để ngắm nhìn lại những khoảnh khắc tuyệt vời.';
        } else {
            greeting = 'Chào buổi tối!';
            subGreeting = 'Hãy cùng nhìn lại những khoảnh khắc tuyệt vời của bạn hôm nay.';
        }

        res.json({
            greeting,
            sub_greeting: subGreeting,
            user_name: req.user.full_name,
            stats: {
                total_photos: counts ? (counts.total_photos || 0) : 0,
                total_videos: counts ? (counts.total_videos || 0) : 0,
                total_albums: totalAlbums,
                total_favorites: counts ? (counts.total_favorites || 0) : 0,
                used_bytes: usedBytes,
                used_formatted: formatBytes(usedBytes),
                quota_bytes: quotaBytes,
                quota_formatted: formatBytes(quotaBytes),
                used_percent: usedPercent,
                on_this_day_count: onThisDayCount
            },
            recent_memories: recentMemories,
            recent_albums: recentAlbums
        });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

module.exports = router;

