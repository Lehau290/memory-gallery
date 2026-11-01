/**
 * MEMORY GALLERY - Authentication & Utility Middleware (Node.js)
 */

const jwt = require('jsonwebtoken');
const db = require('../config/db');

const JWT_SECRET = process.env.JWT_SECRET || 'memory_gallery_super_secret_key_2026';

function formatBytes(bytes, precision = 1) {
    const units = ['B', 'KB', 'MB', 'GB', 'TB'];
    bytes = Math.max(bytes, 0);
    const pow = Math.floor((bytes ? Math.log(bytes) : 0) / Math.log(1024));
    const p = Math.min(pow, units.length - 1);
    bytes /= Math.pow(1024, p);
    return Math.round(bytes * Math.pow(10, precision)) / Math.pow(10, precision) + ' ' + units[p];
}

async function logActivity(userId, action, details = '', ip = '127.0.0.1') {
    try {
        await db.runAsync(
            'INSERT INTO activity_logs (user_id, action, details, ip_address) VALUES (?, ?, ?, ?)',
            [userId, action, details, ip]
        );
    } catch (e) {
        // Silently ignore log errors
    }
}

async function getUserFromReq(req) {
    let token = null;

    // Check Authorization: Bearer <token_or_id>
    const authHeader = req.headers['authorization'];
    if (authHeader && authHeader.startsWith('Bearer ')) {
        token = authHeader.substring(7).trim();
    } else if (req.cookies && req.cookies.token) {
        token = req.cookies.token;
    } else if (req.headers['x-user-id']) {
        token = req.headers['x-user-id'];
    }

    if (!token) return null;

    let userId = null;

    // If numerical token (simple user ID fallback)
    if (/^\d+$/.test(token)) {
        userId = parseInt(token);
    } else {
        try {
            const decoded = jwt.verify(token, JWT_SECRET);
            userId = decoded.id;
        } catch (err) {
            return null;
        }
    }

    if (!userId) return null;

    const user = await db.getAsync(
        'SELECT id, username, email, full_name, avatar_url, bio, role, status, storage_quota, used_storage, created_at FROM users WHERE id = ?',
        [userId]
    );

    if (user && user.status === 'active') {
        return user;
    }
    return null;
}

async function requireAuth(req, res, next) {
    try {
        const user = await getUserFromReq(req);
        if (!user) {
            return res.status(401).json({ error: 'Bạn cần đăng nhập để thực hiện thao tác này.' });
        }
        req.user = user;
        next();
    } catch (err) {
        return res.status(401).json({ error: 'Xác thực không hợp lệ.' });
    }
}

async function requireAdmin(req, res, next) {
    try {
        const user = await getUserFromReq(req);
        if (!user) {
            return res.status(401).json({ error: 'Bạn cần đăng nhập.' });
        }
        if (user.role !== 'admin') {
            return res.status(403).json({ error: 'Bạn không có quyền truy cập khu vực quản trị.' });
        }
        req.user = user;
        next();
    } catch (err) {
        return res.status(403).json({ error: 'Quyền truy cập bị từ chối.' });
    }
}

async function updateUserStorage(userId) {
    const row = await db.getAsync('SELECT SUM(file_size) as total FROM memories WHERE user_id = ?', [userId]);
    const total = row ? (row.total || 0) : 0;
    await db.runAsync('UPDATE users SET used_storage = ? WHERE id = ?', [total, userId]);
    return total;
}

module.exports = {
    JWT_SECRET,
    formatBytes,
    logActivity,
    getUserFromReq,
    requireAuth,
    requireAdmin,
    updateUserStorage
};

