<?php
/**
 * MEMORY GALLERY - Admin Dashboard API
 * /api/admin.php
 */

require_once __DIR__ . '/../config/helpers.php';

$pdo = Database::getConnection();
$adminUser = requireAdmin();

$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
$action = $_GET['action'] ?? 'overview';

$rawInput = file_get_contents('php://input');
$jsonBody = json_decode($rawInput, true) ?? [];
$input = array_merge($_POST, $jsonBody);

switch ($action) {
    case 'overview':
        // 1. Total accounts & status
        $totalUsers = (int)$pdo->query("SELECT COUNT(*) FROM users")->fetchColumn();
        $activeUsers = (int)$pdo->query("SELECT COUNT(*) FROM users WHERE status = 'active'")->fetchColumn();
        $suspendedUsers = (int)$pdo->query("SELECT COUNT(*) FROM users WHERE status = 'suspended'")->fetchColumn();

        // 2. Media counts
        $totalPhotos = (int)$pdo->query("SELECT COUNT(*) FROM memories WHERE file_type = 'image'")->fetchColumn();
        $totalVideos = (int)$pdo->query("SELECT COUNT(*) FROM memories WHERE file_type = 'video'")->fetchColumn();
        $totalAlbums = (int)$pdo->query("SELECT COUNT(*) FROM albums")->fetchColumn();

        // 3. System storage
        $totalSystemStorage = (int)$pdo->query("SELECT COALESCE(SUM(file_size), 0) FROM memories")->fetchColumn();

        // 4. Monthly uploads trend (last 6 months)
        $trendStmt = $pdo->query("SELECT strftime('%Y-%m', created_at) as month, COUNT(*) as uploads_count, SUM(file_size) as bytes 
                                  FROM memories 
                                  GROUP BY month 
                                  ORDER BY month DESC LIMIT 6");
        $uploadTrends = array_reverse($trendStmt->fetchAll());

        // 5. Recent system logs
        $logsStmt = $pdo->query("SELECT l.*, u.username, u.full_name 
                                FROM activity_logs l 
                                LEFT JOIN users u ON l.user_id = u.id 
                                ORDER BY l.id DESC LIMIT 10");
        $recentLogs = $logsStmt->fetchAll();

        jsonResponse([
            'stats' => [
                'total_users' => $totalUsers,
                'active_users' => $activeUsers,
                'suspended_users' => $suspendedUsers,
                'total_photos' => $totalPhotos,
                'total_videos' => $totalVideos,
                'total_albums' => $totalAlbums,
                'total_storage' => $totalSystemStorage,
                'formatted_storage' => formatBytes($totalSystemStorage)
            ],
            'upload_trends' => $uploadTrends,
            'recent_logs' => $recentLogs
        ]);
        break;

    case 'users':
        $search = trim($_GET['search'] ?? '');
        $status = trim($_GET['status'] ?? '');

        $where = ["1=1"];
        $params = [];

        if (!empty($search)) {
            $where[] = "(username LIKE ? OR email LIKE ? OR full_name LIKE ?)";
            $term = '%' . $search . '%';
            $params[] = $term;
            $params[] = $term;
            $params[] = $term;
        }

        if (!empty($status)) {
            $where[] = "status = ?";
            $params[] = $status;
        }

        $sql = "SELECT u.id, u.username, u.email, u.full_name, u.avatar_url, u.role, u.status, u.storage_quota, u.used_storage, u.created_at,
                (SELECT COUNT(*) FROM memories WHERE user_id = u.id) as memory_count,
                (SELECT COUNT(*) FROM albums WHERE user_id = u.id) as album_count
                FROM users u 
                WHERE " . implode(" AND ", $where) . " 
                ORDER BY u.id ASC";

        $stmt = $pdo->prepare($sql);
        $stmt->execute($params);
        $users = $stmt->fetchAll();

        foreach ($users as &$u) {
            $u['formatted_used_storage'] = formatBytes($u['used_storage']);
            $u['formatted_quota'] = formatBytes($u['storage_quota']);
        }

        jsonResponse(['users' => $users]);
        break;

    case 'toggle_user_status':
        if ($method !== 'POST') {
            jsonResponse(['error' => 'Phương thức không hợp lệ.'], 405);
        }

        $targetUserId = (int)($input['user_id'] ?? 0);
        if ($targetUserId === $adminUser['id']) {
            jsonResponse(['error' => 'Bạn không thể tự khóa tài khoản quản trị của chính mình.'], 400);
        }

        $stmt = $pdo->prepare("SELECT status, username FROM users WHERE id = ?");
        $stmt->execute([$targetUserId]);
        $target = $stmt->fetch();

        if (!$target) {
            jsonResponse(['error' => 'Không tìm thấy người dùng.'], 404);
        }

        $newStatus = ($target['status'] === 'active') ? 'suspended' : 'active';
        $update = $pdo->prepare("UPDATE users SET status = ? WHERE id = ?");
        $update->execute([$newStatus, $targetUserId]);

        $actionText = $newStatus === 'active' ? 'Mở khóa' : 'Khóa';
        logActivity($adminUser['id'], 'ADMIN_TOGGLE_STATUS', "$actionText tài khoản: " . $target['username']);

        jsonResponse([
            'message' => "Đã $actionText tài khoản thành công!",
            'new_status' => $newStatus
        ]);
        break;

    case 'storage':
        // Storage breakdown by media type
        $breakdownStmt = $pdo->query("SELECT file_type, mime_type, COUNT(*) as count, SUM(file_size) as total_size 
                                     FROM memories 
                                     GROUP BY file_type, mime_type");
        $breakdown = $breakdownStmt->fetchAll();

        foreach ($breakdown as &$b) {
            $b['formatted_size'] = formatBytes($b['total_size']);
        }

        // Largest files
        $largeFilesStmt = $pdo->query("SELECT m.id, m.title, m.file_name, m.file_path, m.file_type, m.file_size, m.created_at, u.username 
                                      FROM memories m 
                                      JOIN users u ON m.user_id = u.id 
                                      ORDER BY m.file_size DESC LIMIT 15");
        $largeFiles = $largeFilesStmt->fetchAll();
        foreach ($largeFiles as &$lf) {
            $lf['formatted_size'] = formatBytes($lf['file_size']);
        }

        jsonResponse([
            'breakdown' => $breakdown,
            'largest_files' => $largeFiles
        ]);
        break;

    case 'logs':
        $logsStmt = $pdo->query("SELECT l.*, u.username, u.full_name 
                                FROM activity_logs l 
                                LEFT JOIN users u ON l.user_id = u.id 
                                ORDER BY l.id DESC LIMIT 50");
        $logs = $logsStmt->fetchAll();

        jsonResponse(['logs' => $logs]);
        break;

    default:
        jsonResponse(['error' => 'Action không tồn tại.'], 404);
}

