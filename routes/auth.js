/**
 * MEMORY GALLERY - Authentication Router (Node.js)
 */

const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const db = require('../config/db');
const { JWT_SECRET, requireAuth, logActivity, updateUserStorage, getUserFromReq } = require('../middleware/auth');

// Storage for avatar upload
const avatarStorage = multer.diskStorage({
    destination: (req, file, cb) => {
        const dest = path.join(__dirname, '..', 'uploads', 'avatars');
        if (!fs.existsSync(dest)) fs.mkdirSync(dest, { recursive: true });
        cb(null, dest);
    },
    filename: (req, file, cb) => {
        const ext = path.extname(file.originalname);
        cb(null, `avatar_${Date.now()}_${Math.random().toString(36).substring(7)}${ext}`);
    }
});
const uploadAvatar = multer({ storage: avatarStorage, limits: { fileSize: 5 * 1024 * 1024 } });

// GET /api/auth/me or action=me
router.get(['/me', '/'], async (req, res) => {
    try {
        const user = await getUserFromReq(req);
        if (!user) {
            return res.json({ authenticated: false, user: null });
        }
        await updateUserStorage(user.id);
        res.json({ authenticated: true, user });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// POST /api/auth/login
router.post('/login', async (req, res) => {
    try {
        const identity = (req.body.identity || req.body.email || '').trim();
        const password = (req.body.password || '').trim();

        if (!identity || !password) {
            return res.status(422).json({ error: 'Vui lòng nhập email/tên đăng nhập và mật khẩu.' });
        }

        const user = await db.getAsync(
            'SELECT * FROM users WHERE email = ? OR username = ?',
            [identity, identity]
        );

        if (!user || !(await bcrypt.compare(password, user.password_hash))) {
            return res.status(401).json({ error: 'Tài khoản hoặc mật khẩu không chính xác.' });
        }

        if (user.status === 'suspended') {
            return res.status(403).json({ error: 'Tài khoản của bạn đã bị khóa. Vui lòng liên hệ quản trị viên.' });
        }

        const token = jwt.sign({ id: user.id, username: user.username, role: user.role }, JWT_SECRET, { expiresIn: '7d' });
        delete user.password_hash;

        await logActivity(user.id, 'LOGIN', 'Đăng nhập thành công', req.ip);

        res.json({
            message: 'Đăng nhập thành công!',
            user,
            token
        });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// POST /api/auth/register
router.post('/register', async (req, res) => {
    try {
        const fullName = (req.body.full_name || '').trim();
        const username = (req.body.username || '').toLowerCase().trim();
        const email = (req.body.email || '').toLowerCase().trim();
        const password = req.body.password || '';
        const confirmPassword = req.body.confirm_password || '';
        let avatarUrl = (req.body.avatar_url || '').trim();

        if (!fullName || !username || !email || !password) {
            return res.status(422).json({ error: 'Vui lòng điền đầy đủ các thông tin bắt buộc.' });
        }

        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
            return res.status(422).json({ error: 'Địa chỉ email không hợp lệ.' });
        }

        if (username.length < 3 || !/^[a-zA-Z0-9_]+$/.test(username)) {
            return res.status(422).json({ error: 'Tên đăng nhập tối thiểu 3 ký tự và chỉ chứa chữ cái, số, dấu gạch dưới.' });
        }

        if (password.length < 6) {
            return res.status(422).json({ error: 'Mật khẩu phải có độ dài tối thiểu 6 ký tự.' });
        }

        if (password !== confirmPassword) {
            return res.status(422).json({ error: 'Mật khẩu xác nhận không khớp.' });
        }

        const existingEmail = await db.getAsync('SELECT id FROM users WHERE email = ?', [email]);
        if (existingEmail) {
            return res.status(409).json({ error: 'Địa chỉ email này đã được đăng ký.' });
        }

        const existingUser = await db.getAsync('SELECT id FROM users WHERE username = ?', [username]);
        if (existingUser) {
            return res.status(409).json({ error: 'Tên đăng nhập này đã có người sử dụng.' });
        }

        if (!avatarUrl) {
            avatarUrl = 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=400&auto=format&fit=crop&q=80';
        }

        const passwordHash = await bcrypt.hash(password, 10);
        const quota = 21474836480; // 20 GB

        const insertResult = await db.runAsync(`
            INSERT INTO users (username, email, password_hash, full_name, avatar_url, bio, role, status, storage_quota, used_storage) 
            VALUES (?, ?, ?, ?, ?, ?, 'user', 'active', ?, 0)
        `, [username, email, passwordHash, fullName, avatarUrl, 'Chào bạn, tôi đang lưu giữ những kỷ niệm quý giá tại Memory Gallery!', quota]);

        const newUserId = insertResult.lastID;

        // Default starter albums
        await db.runAsync(
            'INSERT INTO albums (user_id, title, description, cover_url, category) VALUES (?, ?, ?, ?, ?)',
            [newUserId, 'Khoảnh khắc thường ngày', 'Những bức ảnh và video đời thường bình dị.', 'https://images.unsplash.com/photo-1511895426328-dc8714191300?w=800&auto=format&fit=crop&q=80', 'Gia đình']
        );
        await db.runAsync(
            'INSERT INTO albums (user_id, title, description, cover_url, category) VALUES (?, ?, ?, ?, ?)',
            [newUserId, 'Chuyến đi đáng nhớ', 'Lưu lại những chuyến hành trình khám phá thế giới.', 'https://images.unsplash.com/photo-1506744038136-46273834b3fb?w=800&auto=format&fit=crop&q=80', 'Du lịch']
        );

        await logActivity(newUserId, 'REGISTER', 'Tạo tài khoản mới thành công', req.ip);

        const newUser = await db.getAsync(
            'SELECT id, username, email, full_name, avatar_url, bio, role, status, storage_quota, used_storage, created_at FROM users WHERE id = ?',
            [newUserId]
        );

        const token = jwt.sign({ id: newUser.id, username: newUser.username, role: newUser.role }, JWT_SECRET, { expiresIn: '7d' });

        res.status(201).json({
            message: 'Đăng ký tài khoản thành công!',
            user: newUser,
            token
        });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// POST /api/auth/logout
router.post('/logout', requireAuth, async (req, res) => {
    await logActivity(req.user.id, 'LOGOUT', 'Đăng xuất khỏi tài khoản', req.ip);
    res.json({ message: 'Đã đăng xuất thành công.' });
});

// POST /api/auth/update_profile
router.post('/update_profile', requireAuth, uploadAvatar.single('avatar_file'), async (req, res) => {
    try {
        const fullName = (req.body.full_name || req.user.full_name).trim();
        const bio = (req.body.bio !== undefined ? req.body.bio : req.user.bio).trim();
        let avatarUrl = req.user.avatar_url;

        if (req.file) {
            avatarUrl = `uploads/avatars/${req.file.filename}`;
        } else if (req.body.avatar_url) {
            avatarUrl = req.body.avatar_url.trim();
        }

        await db.runAsync(
            'UPDATE users SET full_name = ?, bio = ?, avatar_url = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
            [fullName, bio, avatarUrl, req.user.id]
        );

        await logActivity(req.user.id, 'PROFILE_UPDATE', 'Cập nhật thông tin hồ sơ cá nhân', req.ip);

        const updated = await db.getAsync(
            'SELECT id, username, email, full_name, avatar_url, bio, role, status, storage_quota, used_storage, created_at FROM users WHERE id = ?',
            [req.user.id]
        );

        res.json({
            message: 'Cập nhật hồ sơ thành công!',
            user: updated
        });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// POST /api/auth/change_password
router.post('/change_password', requireAuth, async (req, res) => {
    try {
        const { current_password, new_password, confirm_password } = req.body;

        if (!current_password || !new_password) {
            return res.status(422).json({ error: 'Vui lòng nhập mật khẩu hiện tại và mật khẩu mới.' });
        }

        if (new_password.length < 6) {
            return res.status(422).json({ error: 'Mật khẩu mới phải có ít nhất 6 ký tự.' });
        }

        if (new_password !== confirm_password) {
            return res.status(422).json({ error: 'Mật khẩu xác nhận không trùng khớp.' });
        }

        const user = await db.getAsync('SELECT password_hash FROM users WHERE id = ?', [req.user.id]);
        if (!(await bcrypt.compare(current_password, user.password_hash))) {
            return res.status(422).json({ error: 'Mật khẩu hiện tại không chính xác.' });
        }

        const newHash = await bcrypt.hash(new_password, 10);
        await db.runAsync('UPDATE users SET password_hash = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [newHash, req.user.id]);

        await logActivity(req.user.id, 'PASSWORD_CHANGE', 'Đổi mật khẩu tài khoản', req.ip);

        res.json({ message: 'Đổi mật khẩu thành công!' });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// POST /api/auth/forgot_password
router.post('/forgot_password', async (req, res) => {
    const email = (req.body.email || '').toLowerCase().trim();
    if (!email) {
        return res.status(422).json({ error: 'Vui lòng nhập email.' });
    }
    const user = await db.getAsync('SELECT id FROM users WHERE email = ?', [email]);
    if (user) {
        res.json({ message: 'Hệ thống đã ghi nhận yêu cầu khôi phục mật khẩu. Vui lòng đăng nhập với tài khoản Demo@123.' });
    } else {
        res.status(404).json({ error: 'Không tìm thấy tài khoản với email này.' });
    }
});

module.exports = router;

