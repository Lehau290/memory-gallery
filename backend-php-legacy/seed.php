<?php
/**
 * MEMORY GALLERY - Seeder for SQLite / In-app Initializer
 */

class SeedData {
    public static function run(PDO $pdo) {
        // Check if users already seeded
        $check = $pdo->query("SELECT COUNT(*) FROM users")->fetchColumn();
        if ($check > 0) {
            return;
        }

        // Demo password: "Demo@123"
        // Admin password: "Admin@123"
        $passwordHash = password_hash('Demo@123', PASSWORD_BCRYPT);
        $adminPasswordHash = password_hash('Admin@123', PASSWORD_BCRYPT);

        // 1. Users
        $stmt = $pdo->prepare("INSERT INTO users (id, username, email, password_hash, full_name, avatar_url, bio, role, status, storage_quota, used_storage) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)");
        $stmt->execute([
            1,
            'hoanganh',
            'demo@memorygallery.com',
            $passwordHash,
            'Nguyễn Hoàng Ánh',
            'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=400&auto=format&fit=crop&q=80',
            'Nhiếp ảnh gia nghiệp dư, người yêu thích du lịch và lưu giữ những khoảnh khắc thanh xuân.',
            'user',
            'active',
            21474836480, // 20GB
            4529848320  // ~4.2GB
        ]);

        $stmt->execute([
            2,
            'admin',
            'admin@memorygallery.com',
            $adminPasswordHash,
            'Quản Trị Viên',
            'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400&auto=format&fit=crop&q=80',
            'Hệ thống quản lý Memory Gallery',
            'admin',
            'active',
            107374182400, // 100GB
            12582912000
        ]);

        // 2. Albums
        $stmtAlbum = $pdo->prepare("INSERT INTO albums (id, user_id, title, description, cover_url, category) VALUES (?, ?, ?, ?, ?, ?)");
        $albums = [
            [1, 1, 'Chuyến đi Đà Lạt 2024', 'Những ngày rong ruổi giữa sương mù và đồi thông mộng mơ cùng nhóm bạn thân.', 'https://images.unsplash.com/photo-1506744038136-46273834b3fb?w=800&auto=format&fit=crop&q=80', 'Du lịch'],
            [2, 1, 'Khoảnh khắc Gia Đình', 'Bữa cơm sum vầy, tiếng cười trẻ thơ và tình yêu thương vô bờ bến bên cha mẹ.', 'https://images.unsplash.com/photo-1511895426328-dc8714191300?w=800&auto=format&fit=crop&q=80', 'Gia đình'],
            [3, 1, 'Kỷ niệm Thanh Xuân', 'Thời sinh viên nông nổi, những buổi chiều hoàng hôn bên hồ và những ước mơ tuổi trẻ.', 'https://images.unsplash.com/photo-1529156069898-49953e39b3ac?w=800&auto=format&fit=crop&q=80', 'Thanh xuân'],
            [4, 1, 'Sinh nhật tuổi 24', 'Tiệc mừng sinh nhật ấm cúng bên người thân với ánh nến lung linh và những lời chúc.', 'https://images.unsplash.com/photo-1464349095431-e9a21285b5f3?w=800&auto=format&fit=crop&q=80', 'Sinh nhật'],
            [5, 1, 'Hành trình Xuyên Việt', 'Dọc theo bờ biển miền Trung qua những cung đèo ngoạn mục và những bãi biển hoang sơ.', 'https://images.unsplash.com/photo-1469854523086-cc02fe5d8800?w=800&auto=format&fit=crop&q=80', 'Du lịch']
        ];
        foreach ($albums as $a) {
            $stmtAlbum->execute($a);
        }

        // Current month and day for On This Day demonstration:
        $todayMonthDay = date('m-d'); // e.g. 11-01
        $currentYear = (int)date('Y'); // 2026

        // 3. Memories
        $stmtMem = $pdo->prepare("INSERT INTO memories (id, user_id, album_id, title, description, file_path, file_name, file_type, mime_type, file_size, memory_date, location, is_favorite, privacy, duration) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)");
        $memories = [
            [
                1, 1, 1,
                'Bình minh đồi chè Cầu Đất',
                'Sương mai giăng kín thung lũng, ánh mặt trời le lói qua từng đọt chè xanh ngát. Cảm giác hít trọn bầu không khí se lạnh buổi sáng thật tuyệt vời!',
                'https://images.unsplash.com/photo-1506744038136-46273834b3fb?w=1200&auto=format&fit=crop&q=80',
                'cau_dat_sunrise.jpg',
                'image',
                'image/jpeg',
                3840210,
                ($currentYear - 1) . '-' . $todayMonthDay, // 1 year ago today
                'Đà Lạt, Lâm Đồng',
                1,
                'private',
                0
            ],
            [
                2, 1, 1,
                'Cà phê hoàng hôn dốc đá',
                'Ngồi nhâm nhi tách trà thơm ngắm nhìn thành phố lấp lánh ánh đèn khi chiều buông. Một góc nhỏ bình yên giữa lòng Đà Lạt.',
                'https://images.unsplash.com/photo-1447752875215-b2761acb3c5d?w=1200&auto=format&fit=crop&q=80',
                'cafe_hoang_hon.jpg',
                'image',
                'image/jpeg',
                2940120,
                ($currentYear - 1) . '-' . $todayMonthDay, // 1 year ago today
                'Dốc Nhà Bò, Đà Lạt',
                1,
                'private',
                0
            ],
            [
                3, 1, 2,
                'Bữa cơm tất niên gia đình',
                'Cả nhà quây quần bên nồi bánh chưng nghi ngút khói, nghe ba mẹ kể chuyện xưa. Nơi bình yên nhất luôn là mái ấm gia đình.',
                'https://images.unsplash.com/photo-1511895426328-dc8714191300?w=1200&auto=format&fit=crop&q=80',
                'family_dinner.jpg',
                'image',
                'image/jpeg',
                4120900,
                '2025-01-28',
                'Hà Nội, Việt Nam',
                1,
                'private',
                0
            ],
            [
                4, 1, 3,
                'Lễ tốt nghiệp đại học',
                'Khoảnh khắc tung mũ cử nhân đánh dấu chặng đường 4 năm thanh xuân rực rỡ bên thầy cô và những người bạn cùng giảng đường.',
                'https://images.unsplash.com/photo-1523240795612-9a054b0db644?w=1200&auto=format&fit=crop&q=80',
                'graduation_day.jpg',
                'image',
                'image/jpeg',
                3450120,
                '2024-06-25',
                'Đại Học Quốc Gia',
                1,
                'private',
                0
            ],
            [
                5, 1, 1,
                'Rừng thông trong làn sương sớm',
                'Một sớm bình yên đi bộ dưới bóng thông reo, hít thở không khí se se lạnh của vùng cao nguyên đại ngàn.',
                'https://images.unsplash.com/photo-1473448912268-2022ce9509d8?w=1200&auto=format&fit=crop&q=80',
                'pine_forest.jpg',
                'image',
                'image/jpeg',
                5120300,
                ($currentYear - 2) . '-' . $todayMonthDay, // 2 years ago today
                'Đồi Robin, Đà Lạt',
                0,
                'private',
                0
            ],
            [
                6, 1, 4,
                'Ngọn nến ước nguyện sinh nhật',
                'Thổi nến sinh nhật tuổi 24 và cầu chúc một năm mới tràn ngập bình an, sức khỏe và nhiều chuyến đi mới.',
                'https://images.unsplash.com/photo-1464349095431-e9a21285b5f3?w=1200&auto=format&fit=crop&q=80',
                'birthday_cake.jpg',
                'image',
                'image/jpeg',
                2410880,
                '2024-08-14',
                'TP. Hồ Chí Minh',
                0,
                'private',
                0
            ],
            [
                7, 1, 5,
                'Chuyến cắm trại hồ Trị An',
                'Đêm nằm ngắm dải ngân hà lấp lánh và hát nghêu ngao bên đốm lửa trại bập bùng cùng tiếng sóng vỗ nhẹ ven hồ.',
                'https://images.unsplash.com/photo-1510312305653-8ed496efae75?w=1200&auto=format&fit=crop&q=80',
                'camping_tri_an.jpg',
                'image',
                'image/jpeg',
                4810230,
                ($currentYear - 3) . '-' . $todayMonthDay, // 3 years ago today
                'Đồng Nai, Việt Nam',
                1,
                'private',
                0
            ],
            [
                8, 1, 5,
                'Khoảnh khắc lướt sóng biển',
                'Video ngắn ghi lại một buổi chiều chèo SUP và đón những con sóng bạc đầu tuyệt đẹp tại bãi biển Quy Nhơn.',
                'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4',
                'sea_waves.mp4',
                'video',
                'video/mp4',
                15829100,
                '2025-07-20',
                'Biển Quy Nhơn',
                1,
                'private',
                15.2
            ],
            [
                9, 1, 3,
                'Chiều thu Hà Nội rực nắng vàng',
                'Lá vàng rơi ngập lối ven hồ Tây, gió heo may se lạnh đầu mùa khẽ lùa qua từng hàng cây.',
                'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=1200&auto=format&fit=crop&q=80',
                'hanoi_autumn.jpg',
                'image',
                'image/jpeg',
                3210450,
                '2024-10-15',
                'Hồ Tây, Hà Nội',
                1,
                'private',
                0
            ],
            [
                10, 1, 5,
                'Khoảnh khắc vượt đèo Hải Vân',
                'Cung đường đèo uốn lượn ngoạn mục giữa mây trời và biển xanh ngắt của vịnh Lăng Cô.',
                'https://images.unsplash.com/photo-1519681393784-d120267933ba?w=1200&auto=format&fit=crop&q=80',
                'hai_van_pass.jpg',
                'image',
                'image/jpeg',
                4200150,
                '2025-04-30',
                'Đèo Hải Vân, Đà Nẵng',
                0,
                'private',
                0
            ]
        ];

        foreach ($memories as $m) {
            $stmtMem->execute($m);
        }

        // 4. Tags
        $stmtTag = $pdo->prepare("INSERT INTO tags (id, user_id, name) VALUES (?, ?, ?)");
        $tags = [
            [1, 1, 'Du lịch'],
            [2, 1, 'Đà Lạt'],
            [3, 1, 'Gia đình'],
            [4, 1, 'Thanh xuân'],
            [5, 1, 'Sinh nhật'],
            [6, 1, 'Hoàng hôn'],
            [7, 1, 'Biển cả'],
            [8, 1, 'Camping']
        ];
        foreach ($tags as $t) {
            $stmtTag->execute($t);
        }

        // 5. Memory Tags
        $stmtMT = $pdo->prepare("INSERT INTO memory_tags (memory_id, tag_id) VALUES (?, ?)");
        $mts = [
            [1, 1], [1, 2],
            [2, 2], [2, 6],
            [3, 3],
            [4, 4],
            [5, 1], [5, 2],
            [6, 5],
            [7, 1], [7, 4], [7, 8],
            [8, 1], [8, 7],
            [9, 4], [9, 6],
            [10, 1]
        ];
        foreach ($mts as $mt) {
            $stmtMT->execute($mt);
        }

        // 6. Activity logs
        $stmtLog = $pdo->prepare("INSERT INTO activity_logs (user_id, action, details, ip_address) VALUES (?, ?, ?, ?)");
        $stmtLog->execute([1, 'LOGIN', 'Đăng nhập thành công vào hệ thống', '127.0.0.1']);
        $stmtLog->execute([1, 'UPLOAD', 'Tải lên 2 ảnh kỷ niệm mới: Cầu Đất & Dốc Đá', '127.0.0.1']);
        $stmtLog->execute([2, 'ADMIN_INIT', 'Khởi tạo hệ thống quản trị', '127.0.0.1']);
    }
}

