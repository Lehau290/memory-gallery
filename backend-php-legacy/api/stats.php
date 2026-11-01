<?php
/**
 * MEMORY GALLERY - Dashboard Stats API
 * /api/stats.php
 */

require_once __DIR__ . '/../config/helpers.php';

$pdo = Database::getConnection();
$user = requireAuth();
$userId = $user['id'];

// 1. Photos and Videos counts
$stmtCounts = $pdo->prepare("SELECT 
    COUNT(*) as total_items,
    SUM(CASE WHEN file_type = 'image' THEN 1 ELSE 0 END) as total_photos,
    SUM(CASE WHEN file_type = 'video' THEN 1 ELSE 0 END) as total_videos,
    SUM(CASE WHEN is_favorite = 1 THEN 1 ELSE 0 END) as total_favorites,
    COALESCE(SUM(file_size), 0) as used_bytes
    FROM memories WHERE user_id = ?");
$stmtCounts->execute([$userId]);
$counts = $stmtCounts->fetch();

// 2. Albums count
$stmtAlbums = $pdo->prepare("SELECT COUNT(*) FROM albums WHERE user_id = ?");
$stmtAlbums->execute([$userId]);
$totalAlbums = (int)$stmtAlbums->fetchColumn();

// 3. Storage calculation
$usedBytes = (int)$counts['used_bytes'];
$quotaBytes = (int)($user['storage_quota'] ?? 21474836480); // 20GB default
$usedPercent = $quotaBytes > 0 ? round(($usedBytes / $quotaBytes) * 100, 1) : 0;

// Update used storage in user record
$up = $pdo->prepare("UPDATE users SET used_storage = ? WHERE id = ?");
$up->execute([$usedBytes, $userId]);

// 4. On this day count
$todayMD = date('m-d');
$currentY = date('Y');
$stmtOTD = $pdo->prepare("SELECT COUNT(*) FROM memories 
                          WHERE user_id = ? 
                          AND (strftime('%m-%d', memory_date) = ? OR strftime('%m-%d', created_at) = ?)
                          AND (strftime('%Y', memory_date) < ? OR strftime('%Y', created_at) < ?)");
$stmtOTD->execute([$userId, $todayMD, $todayMD, $currentY, $currentY]);
$onThisDayCount = (int)$stmtOTD->fetchColumn();

// 5. Recent memories
$stmtRecent = $pdo->prepare("SELECT id, title, description, file_path, file_type, memory_date, is_favorite, location 
                             FROM memories 
                             WHERE user_id = ? 
                             ORDER BY created_at DESC, id DESC LIMIT 8");
$stmtRecent->execute([$userId]);
$recentMemories = $stmtRecent->fetchAll();

// 6. Recent albums
$stmtRecentAlbums = $pdo->prepare("SELECT a.*, COUNT(m.id) as items_count 
                                   FROM albums a 
                                   LEFT JOIN memories m ON a.id = m.album_id 
                                   WHERE a.user_id = ? 
                                   GROUP BY a.id 
                                   ORDER BY a.created_at DESC LIMIT 4");
$stmtRecentAlbums->execute([$userId]);
$recentAlbums = $stmtRecentAlbums->fetchAll();

// 7. Time of day greeting in Vietnamese
$hour = (int)date('H');
if ($hour >= 5 && $hour < 12) {
    $greeting = "Chào buổi sáng!";
    $subGreeting = "Khởi đầu ngày mới tràn đầy năng lượng cùng những kỷ niệm đẹp.";
} elseif ($hour >= 12 && $hour < 18) {
    $greeting = "Chào buổi chiều!";
    $subGreeting = "Dành một chút thời gian thư giãn để ngắm nhìn lại những khoảnh khắc tuyệt vời.";
} else {
    $greeting = "Chào buổi tối!";
    $subGreeting = "Hãy cùng nhìn lại những khoảnh khắc tuyệt vời của bạn hôm nay.";
}

jsonResponse([
    'greeting' => $greeting,
    'sub_greeting' => $subGreeting,
    'user_name' => $user['full_name'],
    'stats' => [
        'total_photos' => (int)$counts['total_photos'],
        'total_videos' => (int)$counts['total_videos'],
        'total_albums' => $totalAlbums,
        'total_favorites' => (int)$counts['total_favorites'],
        'used_bytes' => $usedBytes,
        'used_formatted' => formatBytes($usedBytes),
        'quota_bytes' => $quotaBytes,
        'quota_formatted' => formatBytes($quotaBytes),
        'used_percent' => $usedPercent,
        'on_this_day_count' => $onThisDayCount
    ],
    'recent_memories' => $recentMemories,
    'recent_albums' => $recentAlbums
]);

