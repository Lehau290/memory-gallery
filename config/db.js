/**
 * MEMORY GALLERY - SQLite Database Connection & Initialization (Node.js)
 */

const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');
const bcrypt = require('bcryptjs');

const dbDir = path.join(__dirname, '..', 'database');
if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
}

const dbPath = path.join(dbDir, 'memory_gallery.sqlite');
const isNewDb = !fs.existsSync(dbPath);

const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error('Lỗi kết nối cơ sở dữ liệu SQLite:', err.message);
    } else {
        console.log('✅ Đã kết nối cơ sở dữ liệu SQLite tại:', dbPath);
    }
});

// Promisified database helpers for async/await
db.getAsync = function(sql, params = []) {
    return new Promise((resolve, reject) => {
        db.get(sql, params, (err, row) => {
            if (err) reject(err);
            else resolve(row);
        });
    });
};

db.allAsync = function(sql, params = []) {
    return new Promise((resolve, reject) => {
        db.all(sql, params, (err, rows) => {
            if (err) reject(err);
            else resolve(rows || []);
        });
    });
};

db.runAsync = function(sql, params = []) {
    return new Promise((resolve, reject) => {
        db.run(sql, params, function(err) {
            if (err) reject(err);
            else resolve({ lastID: this.lastID, changes: this.changes });
        });
    });
};

// Initialize schema and initial data
async function initDatabase() {
    try {
        await db.runAsync('PRAGMA foreign_keys = ON;');

        await db.runAsync(`
            CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                username TEXT UNIQUE NOT NULL,
                email TEXT UNIQUE NOT NULL,
                password_hash TEXT NOT NULL,
                full_name TEXT NOT NULL,
                avatar_url TEXT DEFAULT '',
                bio TEXT DEFAULT '',
                role TEXT DEFAULT 'user',
                status TEXT DEFAULT 'active',
                storage_quota INTEGER DEFAULT 21474836480, -- 20 GB
                used_storage INTEGER DEFAULT 0,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
            );
        `);

        await db.runAsync(`
            CREATE TABLE IF NOT EXISTS albums (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                title TEXT NOT NULL,
                description TEXT DEFAULT '',
                cover_url TEXT DEFAULT '',
                category TEXT DEFAULT 'general',
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            );
        `);

        await db.runAsync(`
            CREATE TABLE IF NOT EXISTS memories (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                album_id INTEGER NULL,
                title TEXT NOT NULL,
                description TEXT DEFAULT '',
                file_path TEXT NOT NULL,
                file_name TEXT NOT NULL,
                file_type TEXT NOT NULL, -- 'image' or 'video'
                mime_type TEXT NOT NULL,
                file_size INTEGER NOT NULL,
                memory_date DATE NOT NULL,
                location TEXT DEFAULT '',
                is_favorite INTEGER DEFAULT 0,
                privacy TEXT DEFAULT 'private',
                duration REAL DEFAULT 0,
                width INTEGER DEFAULT 0,
                height INTEGER DEFAULT 0,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
                FOREIGN KEY (album_id) REFERENCES albums(id) ON DELETE SET NULL
            );
        `);

        await db.runAsync(`
            CREATE TABLE IF NOT EXISTS tags (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                name TEXT NOT NULL,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
                UNIQUE(user_id, name)
            );
        `);

        await db.runAsync(`
            CREATE TABLE IF NOT EXISTS memory_tags (
                memory_id INTEGER NOT NULL,
                tag_id INTEGER NOT NULL,
                PRIMARY KEY (memory_id, tag_id),
                FOREIGN KEY (memory_id) REFERENCES memories(id) ON DELETE CASCADE,
                FOREIGN KEY (tag_id) REFERENCES tags(id) ON DELETE CASCADE
            );
        `);

        await db.runAsync(`
            CREATE TABLE IF NOT EXISTS activity_logs (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NULL,
                action TEXT NOT NULL,
                details TEXT DEFAULT '',
                ip_address TEXT DEFAULT '',
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            );
        `);

        // Check and seed default data
        const userCount = await db.getAsync('SELECT COUNT(*) as count FROM users');
        if (!userCount || userCount.count === 0) {
            console.log('🌱 Đang khởi tạo dữ liệu mẫu cho Memory Gallery...');
            await seedInitialData();
            console.log('✅ Khởi tạo dữ liệu mẫu thành công!');
        }
    } catch (err) {
        console.error('Lỗi khi thiết lập cơ sở dữ liệu:', err);
    }
}

async function seedInitialData() {
    const demoPassHash = await bcrypt.hash('123456', 10);
    const adminPassHash = await bcrypt.hash('123456', 10);

    // 1. Users
    await db.runAsync(`
        INSERT INTO users (id, username, email, password_hash, full_name, avatar_url, bio, role, status, storage_quota, used_storage) 
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
        1,
        'baongoc',
        'baongoc@memorygallery.com',
        demoPassHash,
        'Nguyễn Thị Bảo Ngọc',
        'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=400&auto=format&fit=crop&q=80',
        'Người yêu thích du lịch và lưu giữ những khoảnh khắc thanh xuân.',
        'user',
        'active',
        21474836480,
        49932460
    ]);

    await db.runAsync(`
        INSERT INTO users (id, username, email, password_hash, full_name, avatar_url, bio, role, status, storage_quota, used_storage) 
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
        2,
        'letrunghau',
        'letrunghau@memorygallery.com',
        adminPassHash,
        'Lê Trung Hậu',
        'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400&auto=format&fit=crop&q=80',
        'Quản trị viên hệ thống Memory Gallery',
        'admin',
        'active',
        107374182400,
        12582912000
    ]);

    // 2. Albums
    const albums = [
        [1, 1, 'Chuyến đi Đà Lạt 2024', 'Những ngày rong ruổi giữa sương mù và đồi thông mộng mơ cùng nhóm bạn thân.', 'https://images.unsplash.com/photo-1506744038136-46273834b3fb?w=800&auto=format&fit=crop&q=80', 'Du lịch'],
        [2, 1, 'Khoảnh khắc Gia Đình', 'Bữa cơm sum vầy, tiếng cười trẻ thơ và tình yêu thương vô bờ bến bên cha mẹ.', 'https://images.unsplash.com/photo-1511895426328-dc8714191300?w=800&auto=format&fit=crop&q=80', 'Gia đình'],
        [3, 1, 'Kỷ niệm Thanh Xuân', 'Thời sinh viên nông nổi, những buổi chiều hoàng hôn bên hồ và những ước mơ tuổi trẻ.', 'https://images.unsplash.com/photo-1529156069898-49953e39b3ac?w=800&auto=format&fit=crop&q=80', 'Thanh xuân'],
        [4, 1, 'Sinh nhật tuổi 24', 'Tiệc mừng sinh nhật ấm cúng bên người thân với ánh nến lung linh và những lời chúc.', 'https://images.unsplash.com/photo-1464349095431-e9a21285b5f3?w=800&auto=format&fit=crop&q=80', 'Sinh nhật'],
        [5, 1, 'Hành trình Xuyên Việt', 'Dọc theo bờ biển miền Trung qua những cung đèo ngoạn mục và những bãi biển hoang sơ.', 'https://images.unsplash.com/photo-1469854523086-cc02fe5d8800?w=800&auto=format&fit=crop&q=80', 'Du lịch']
    ];
    for (const a of albums) {
        await db.runAsync('INSERT INTO albums (id, user_id, title, description, cover_url, category) VALUES (?, ?, ?, ?, ?, ?)', a);
    }

    // 3. Memories across multiple years + On This Day matches
    const now = new Date();
    const currentYear = now.getFullYear();
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const dd = String(now.getDate()).padStart(2, '0');
    const todayMD = `${mm}-${dd}`;

    const memories = [
        [1, 1, 1, 'Bình minh đồi chè Cầu Đất', 'Sương mai giăng kín thung lũng, ánh mặt trời le lói qua từng đọt chè xanh ngát.', 'https://images.unsplash.com/photo-1506744038136-46273834b3fb?w=1200&auto=format&fit=crop&q=80', 'cau_dat_sunrise.jpg', 'image', 'image/jpeg', 3840210, `${currentYear - 1}-${todayMD}`, 'Đà Lạt, Lâm Đồng', 1, 'private', 0],
        [2, 1, 1, 'Cà phê hoàng hôn dốc đá', 'Ngồi nhâm nhi tách trà thơm ngắm nhìn thành phố lấp lánh ánh đèn khi chiều buông.', 'https://images.unsplash.com/photo-1447752875215-b2761acb3c5d?w=1200&auto=format&fit=crop&q=80', 'cafe_hoang_hon.jpg', 'image', 'image/jpeg', 2940120, `${currentYear - 1}-${todayMD}`, 'Dốc Nhà Bò, Đà Lạt', 1, 'private', 0],
        [3, 1, 2, 'Bữa cơm tất niên gia đình', 'Cả nhà quây quần bên nồi bánh chưng nghi ngút khói, nghe ba mẹ kể chuyện xưa.', 'https://images.unsplash.com/photo-1511895426328-dc8714191300?w=1200&auto=format&fit=crop&q=80', 'family_dinner.jpg', 'image', 'image/jpeg', 4120900, '2025-01-28', 'Hà Nội, Việt Nam', 1, 'private', 0],
        [4, 1, 3, 'Lễ tốt nghiệp đại học', 'Khoảnh khắc tung mũ cử nhân đánh dấu chặng đường 4 năm thanh xuân rực rỡ.', 'https://images.unsplash.com/photo-1523240795612-9a054b0db644?w=1200&auto=format&fit=crop&q=80', 'graduation_day.jpg', 'image', 'image/jpeg', 3450120, '2024-06-25', 'Đại Học Quốc Gia', 1, 'private', 0],
        [5, 1, 1, 'Rừng thông trong làn sương sớm', 'Một sớm bình yên đi bộ dưới bóng thông reo, hít thở không khí se se lạnh của vùng cao nguyên.', 'https://images.unsplash.com/photo-1473448912268-2022ce9509d8?w=1200&auto=format&fit=crop&q=80', 'pine_forest.jpg', 'image', 'image/jpeg', 5120300, `${currentYear - 2}-${todayMD}`, 'Đồi Robin, Đà Lạt', 0, 'private', 0],
        [6, 1, 4, 'Ngọn nến ước nguyện sinh nhật', 'Thổi nến sinh nhật tuổi 24 và cầu chúc một năm mới tràn ngập bình an.', 'https://images.unsplash.com/photo-1464349095431-e9a21285b5f3?w=1200&auto=format&fit=crop&q=80', 'birthday_cake.jpg', 'image', 'image/jpeg', 2410880, '2024-08-14', 'TP. Hồ Chí Minh', 0, 'private', 0],
        [7, 1, 5, 'Chuyến cắm trại hồ Trị An', 'Đêm nằm ngắm dải ngân hà lấp lánh và hát nghêu ngao bên đốm lửa trại bập bùng.', 'https://images.unsplash.com/photo-1510312305653-8ed496efae75?w=1200&auto=format&fit=crop&q=80', 'camping_tri_an.jpg', 'image', 'image/jpeg', 4810230, `${currentYear - 3}-${todayMD}`, 'Đồng Nai, Việt Nam', 1, 'private', 0],
        [8, 1, 5, 'Khoảnh khắc lướt sóng biển', 'Video ngắn ghi lại một buổi chiều chèo SUP và đón những con sóng bạc đầu.', 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4', 'sea_waves.mp4', 'video', 'video/mp4', 15829100, '2025-07-20', 'Biển Quy Nhơn', 1, 'private', 15.2],
        [9, 1, 3, 'Chiều thu Hà Nội rực nắng vàng', 'Lá vàng rơi ngập lối ven hồ Tây, gió heo may se lạnh đầu mùa.', 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=1200&auto=format&fit=crop&q=80', 'hanoi_autumn.jpg', 'image', 'image/jpeg', 3210450, '2024-10-15', 'Hồ Tây, Hà Nội', 1, 'private', 0],
        [10, 1, 5, 'Khoảnh khắc vượt đèo Hải Vân', 'Cung đường đèo uốn lượn ngoạn mục giữa mây trời và biển xanh ngắt.', 'https://images.unsplash.com/photo-1519681393784-d120267933ba?w=1200&auto=format&fit=crop&q=80', 'hai_van_pass.jpg', 'image', 'image/jpeg', 4200150, '2025-04-30', 'Đèo Hải Vân, Đà Nẵng', 0, 'private', 0]
    ];

    for (const m of memories) {
        await db.runAsync(`
            INSERT INTO memories (id, user_id, album_id, title, description, file_path, file_name, file_type, mime_type, file_size, memory_date, location, is_favorite, privacy, duration)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, m);
    }

    // 4. Tags
    const tags = [
        [1, 1, 'Du lịch'], [2, 1, 'Đà Lạt'], [3, 1, 'Gia đình'],
        [4, 1, 'Thanh xuân'], [5, 1, 'Sinh nhật'], [6, 1, 'Hoàng hôn'],
        [7, 1, 'Biển cả'], [8, 1, 'Camping']
    ];
    for (const t of tags) {
        await db.runAsync('INSERT INTO tags (id, user_id, name) VALUES (?, ?, ?)', t);
    }

    // 5. Memory tags
    const mts = [
        [1, 1], [1, 2], [2, 2], [2, 6], [3, 3], [4, 4],
        [5, 1], [5, 2], [6, 5], [7, 1], [7, 4], [7, 8],
        [8, 1], [8, 7], [9, 4], [9, 6], [10, 1]
    ];
    for (const mt of mts) {
        await db.runAsync('INSERT INTO memory_tags (memory_id, tag_id) VALUES (?, ?)', mt);
    }

    // 6. Logs
    await db.runAsync('INSERT INTO activity_logs (user_id, action, details, ip_address) VALUES (?, ?, ?, ?)', [
        1, 'LOGIN', 'Đăng nhập vào hệ thống Memory Gallery', '127.0.0.1'
    ]);
    await db.runAsync('INSERT INTO activity_logs (user_id, action, details, ip_address) VALUES (?, ?, ?, ?)', [
        2, 'ADMIN_INIT', 'Khởi tạo hệ thống quản trị Node.js', '127.0.0.1'
    ]);
}

initDatabase();

module.exports = db;

