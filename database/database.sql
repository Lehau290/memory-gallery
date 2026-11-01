-- =======================================================
-- MEMORY GALLERY - MySQL Database Schema & Sample Data
-- For XAMPP / phpMyAdmin / MySQL 5.7+ / 8.0+
-- Database Name: memory_gallery
-- =======================================================

CREATE DATABASE IF NOT EXISTS `memory_gallery` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE `memory_gallery`;

-- 1. Table: users
DROP TABLE IF EXISTS `memory_tags`;
DROP TABLE IF EXISTS `tags`;
DROP TABLE IF EXISTS `memories`;
DROP TABLE IF EXISTS `albums`;
DROP TABLE IF EXISTS `activity_logs`;
DROP TABLE IF EXISTS `users`;

CREATE TABLE `users` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `username` VARCHAR(60) NOT NULL UNIQUE,
    `email` VARCHAR(191) NOT NULL UNIQUE,
    `password_hash` VARCHAR(255) NOT NULL,
    `full_name` VARCHAR(120) NOT NULL,
    `avatar_url` VARCHAR(255) DEFAULT '',
    `bio` TEXT,
    `role` ENUM('user', 'admin') DEFAULT 'user',
    `status` ENUM('active', 'suspended') DEFAULT 'active',
    `storage_quota` BIGINT DEFAULT 21474836480, -- 20 GB in bytes
    `used_storage` BIGINT DEFAULT 0,
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 2. Table: albums
CREATE TABLE `albums` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `user_id` INT NOT NULL,
    `title` VARCHAR(150) NOT NULL,
    `description` TEXT,
    `cover_url` VARCHAR(255) DEFAULT '',
    `category` VARCHAR(50) DEFAULT 'general',
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 3. Table: memories
CREATE TABLE `memories` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `user_id` INT NOT NULL,
    `album_id` INT NULL,
    `title` VARCHAR(200) NOT NULL,
    `description` TEXT,
    `file_path` VARCHAR(255) NOT NULL,
    `file_name` VARCHAR(255) NOT NULL,
    `file_type` ENUM('image', 'video') NOT NULL,
    `mime_type` VARCHAR(80) NOT NULL,
    `file_size` BIGINT NOT NULL,
    `memory_date` DATE NOT NULL,
    `location` VARCHAR(150) DEFAULT '',
    `is_favorite` TINYINT(1) DEFAULT 0,
    `privacy` ENUM('private', 'shared') DEFAULT 'private',
    `duration` FLOAT DEFAULT 0,
    `width` INT DEFAULT 0,
    `height` INT DEFAULT 0,
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE,
    FOREIGN KEY (`album_id`) REFERENCES `albums`(`id`) ON DELETE SET NULL,
    INDEX `idx_mem_user_date` (`user_id`, `memory_date`),
    INDEX `idx_mem_favorite` (`user_id`, `is_favorite`),
    INDEX `idx_mem_album` (`album_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 4. Table: tags
CREATE TABLE `tags` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `user_id` INT NOT NULL,
    `name` VARCHAR(50) NOT NULL,
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE,
    UNIQUE KEY `unique_user_tag` (`user_id`, `name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 5. Table: memory_tags
CREATE TABLE `memory_tags` (
    `memory_id` INT NOT NULL,
    `tag_id` INT NOT NULL,
    PRIMARY KEY (`memory_id`, `tag_id`),
    FOREIGN KEY (`memory_id`) REFERENCES `memories`(`id`) ON DELETE CASCADE,
    FOREIGN KEY (`tag_id`) REFERENCES `tags`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 6. Table: activity_logs
CREATE TABLE `activity_logs` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `user_id` INT NULL,
    `action` VARCHAR(100) NOT NULL,
    `details` TEXT,
    `ip_address` VARCHAR(45) DEFAULT '',
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =======================================================
-- SAMPLE DATA (Mật khẩu mặc định: 123456)
-- Hash BCRYPT: $2y$10$fcjVH1xAdD4/rTtpRjfOsOZHiMZi/yPXoJzqSdvhpiGgWWz2BWid. (Password: 123456)
-- =======================================================

INSERT INTO `users` (`id`, `username`, `email`, `password_hash`, `full_name`, `avatar_url`, `bio`, `role`, `status`, `storage_quota`, `used_storage`) VALUES
(1, 'baongoc', 'baongoc@memorygallery.com', '$2y$10$fcjVH1xAdD4/rTtpRjfOsOZHiMZi/yPXoJzqSdvhpiGgWWz2BWid.', 'Nguyễn Thị Bảo Ngọc', 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=400&auto=format&fit=crop&q=80', 'Người yêu thích du lịch và lưu giữ những khoảnh khắc thanh xuân.', 'user', 'active', 21474836480, 4529848320),
(2, 'letrunghau', 'letrunghau@memorygallery.com', '$2y$10$fcjVH1xAdD4/rTtpRjfOsOZHiMZi/yPXoJzqSdvhpiGgWWz2BWid.', 'Lê Trung Hậu', 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400&auto=format&fit=crop&q=80', 'Quản trị viên hệ thống Memory Gallery', 'admin', 'active', 107374182400, 12582912000);

-- Albums for User 1
INSERT INTO `albums` (`id`, `user_id`, `title`, `description`, `cover_url`, `category`) VALUES
(1, 1, 'Chuyến đi Đà Lạt 2024', 'Những ngày rong ruổi giữa sương mù và đồi thông mộng mơ cùng nhóm bạn thân.', 'https://images.unsplash.com/photo-1506744038136-46273834b3fb?w=800&auto=format&fit=crop&q=80', 'Du lịch'),
(2, 1, 'Khoảnh khắc Gia Đình', 'Bữa cơm sum vầy, tiếng cười trẻ thơ và tình yêu thương vô bờ bến bên cha mẹ.', 'https://images.unsplash.com/photo-1511895426328-dc8714191300?w=800&auto=format&fit=crop&q=80', 'Gia đình'),
(3, 1, 'Kỷ niệm Thanh Xuân', 'Thời sinh viên nông nổi, những buổi chiều hoàng hôn bên hồ và những ước mơ tuổi trẻ.', 'https://images.unsplash.com/photo-1529156069898-49953e39b3ac?w=800&auto=format&fit=crop&q=80', 'Thanh xuân'),
(4, 1, 'Sinh nhật tuổi 24', 'Tiệc mừng sinh nhật ấm cúng bên người thân với ánh nến lung linh và những lời chúc.', 'https://images.unsplash.com/photo-1464349095431-e9a21285b5f3?w=800&auto=format&fit=crop&q=80', 'Sinh nhật');

-- Memories for User 1 (Spanning multiple years, including November 1st for "On This Day")
INSERT INTO `memories` (`id`, `user_id`, `album_id`, `title`, `description`, `file_path`, `file_name`, `file_type`, `mime_type`, `file_size`, `memory_date`, `location`, `is_favorite`, `privacy`) VALUES
(1, 1, 1, 'Bình minh đồi chè Cầu Đất', 'Sương mai giăng kín thung lũng, ánh mặt trời le lói qua từng đọt chè xanh ngát.', 'https://images.unsplash.com/photo-1506744038136-46273834b3fb?w=1200&auto=format&fit=crop&q=80', 'cau_dat_sunrise.jpg', 'image', 'image/jpeg', 3840210, '2025-11-01', 'Đà Lạt, Lâm Đồng', 1, 'private'),
(2, 1, 1, 'Cà phê hoàng hôn dốc đá', 'Ngồi nhâm nhi tách trà nóng ngắm nhìn thành phố lấp lánh ánh đèn khi chiều buông.', 'https://images.unsplash.com/photo-1447752875215-b2761acb3c5d?w=1200&auto=format&fit=crop&q=80', 'cafe_hoang_hon.jpg', 'image', 'image/jpeg', 2940120, '2025-11-01', 'Dốc Nhà Bò, Đà Lạt', 1, 'private'),
(3, 1, 2, 'Bữa cơm tất niên gia đình', 'Cả nhà quây quần bên nồi bánh chưng nghi ngút khói, nghe ba mẹ kể chuyện xưa.', 'https://images.unsplash.com/photo-1511895426328-dc8714191300?w=1200&auto=format&fit=crop&q=80', 'family_dinner.jpg', 'image', 'image/jpeg', 4120900, '2024-02-09', 'Hà Nội, Việt Nam', 1, 'private'),
(4, 1, 3, 'Lễ tốt nghiệp đại học', 'Khoảnh khắc tung mũ cử nhân đánh dấu chặng đường 4 năm thanh xuân rực rỡ.', 'https://images.unsplash.com/photo-1523240795612-9a054b0db644?w=1200&auto=format&fit=crop&q=80', 'graduation_day.jpg', 'image', 'image/jpeg', 3450120, '2024-06-25', 'Đại Học Quốc Gia', 1, 'private'),
(5, 1, 1, 'Rừng thông trong làn sương sớm', 'Một sớm bình yên đi bộ dưới bóng thông reo, hít thở không khí se se lạnh của vùng cao nguyên.', 'https://images.unsplash.com/photo-1473448912268-2022ce9509d8?w=1200&auto=format&fit=crop&q=80', 'pine_forest.jpg', 'image', 'image/jpeg', 5120300, '2024-11-01', 'Đồi Robin, Đà Lạt', 0, 'private'),
(6, 1, 4, 'Ngọn nến ước nguyện sinh nhật', 'Thổi nến sinh nhật tuổi 24 và cầu chúc một năm mới tràn ngập bình an và hạnh phúc.', 'https://images.unsplash.com/photo-1464349095431-e9a21285b5f3?w=1200&auto=format&fit=crop&q=80', 'birthday_cake.jpg', 'image', 'image/jpeg', 2410880, '2024-08-14', 'TP. Hồ Chí Minh', 0, 'private'),
(7, 1, 3, 'Chuyến cắm trại hồ Trị An', 'Đêm nằm ngắm dải ngân hà lấp lánh và hát nghêu ngao bên đốm lửa trại bập bùng.', 'https://images.unsplash.com/photo-1510312305653-8ed496efae75?w=1200&auto=format&fit=crop&q=80', 'camping_tri_an.jpg', 'image', 'image/jpeg', 4810230, '2023-11-01', 'Đồng Nai, Việt Nam', 1, 'private'),
(8, 1, 1, 'Khoảnh khắc lướt sóng biển', 'Video ngắn ghi lại một buổi chiều chèo SUP và đón những con sóng bạc đầu tại bãi biển Quy Nhơn.', 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4', 'sea_waves.mp4', 'video', 'video/mp4', 15829100, '2025-07-20', 'Biển Quy Nhơn', 1, 'private');

-- Tags
INSERT INTO `tags` (`id`, `user_id`, `name`) VALUES
(1, 1, 'Du lịch'),
(2, 1, 'Đà Lạt'),
(3, 1, 'Gia đình'),
(4, 1, 'Thanh xuân'),
(5, 1, 'Sinh nhật'),
(6, 1, 'Hoàng hôn');

-- Memory Tag links
INSERT INTO `memory_tags` (`memory_id`, `tag_id`) VALUES
(1, 1), (1, 2),
(2, 2), (2, 6),
(3, 3),
(4, 4),
(5, 1), (5, 2),
(6, 5),
(7, 1), (7, 4),
(8, 1);

