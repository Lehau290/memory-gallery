<?php
/**
 * MEMORY GALLERY - Albums API
 * /api/albums.php
 */

require_once __DIR__ . '/../config/helpers.php';

$pdo = Database::getConnection();
$user = requireAuth();
$userId = $user['id'];

$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
$action = $_GET['action'] ?? ($method === 'POST' ? 'create' : 'list');

$rawInput = file_get_contents('php://input');
$jsonBody = json_decode($rawInput, true) ?? [];
$input = array_merge($_POST, $jsonBody);

switch ($action) {
    case 'list':
        $search = trim($_GET['search'] ?? '');
        $category = trim($_GET['category'] ?? '');

        $where = ["a.user_id = ?"];
        $params = [$userId];

        if (!empty($search)) {
            $where[] = "(a.title LIKE ? OR a.description LIKE ?)";
            $params[] = '%' . $search . '%';
            $params[] = '%' . $search . '%';
        }

        if (!empty($category) && $category !== 'all') {
            $where[] = "a.category = ?";
            $params[] = $category;
        }

        $sql = "SELECT a.*, 
                COUNT(m.id) as total_items,
                SUM(CASE WHEN m.file_type = 'image' THEN 1 ELSE 0 END) as total_photos,
                SUM(CASE WHEN m.file_type = 'video' THEN 1 ELSE 0 END) as total_videos,
                (SELECT file_path FROM memories WHERE album_id = a.id ORDER BY memory_date DESC LIMIT 1) as latest_photo
                FROM albums a 
                LEFT JOIN memories m ON a.id = m.album_id AND m.user_id = a.user_id
                WHERE " . implode(" AND ", $where) . " 
                GROUP BY a.id 
                ORDER BY a.created_at DESC";

        $stmt = $pdo->prepare($sql);
        $stmt->execute($params);
        $albums = $stmt->fetchAll();

        foreach ($albums as &$alb) {
            $alb['total_items'] = (int)$alb['total_items'];
            $alb['total_photos'] = (int)$alb['total_photos'];
            $alb['total_videos'] = (int)$alb['total_videos'];
            if (empty($alb['cover_url'])) {
                $alb['cover_url'] = $alb['latest_photo'] ?: 'https://images.unsplash.com/photo-1506744038136-46273834b3fb?w=800&auto=format&fit=crop&q=80';
            }
        }

        jsonResponse([
            'count' => count($albums),
            'albums' => $albums
        ]);
        break;

    case 'get':
        $id = (int)($_GET['id'] ?? 0);
        $stmt = $pdo->prepare("SELECT a.*, 
                               COUNT(m.id) as total_items,
                               SUM(CASE WHEN m.file_type = 'image' THEN 1 ELSE 0 END) as total_photos,
                               SUM(CASE WHEN m.file_type = 'video' THEN 1 ELSE 0 END) as total_videos
                               FROM albums a 
                               LEFT JOIN memories m ON a.id = m.album_id
                               WHERE a.id = ? AND a.user_id = ?
                               GROUP BY a.id");
        $stmt->execute([$id, $userId]);
        $album = $stmt->fetch();

        if (!$album) {
            jsonResponse(['error' => 'Không tìm thấy album này.'], 404);
        }

        // Get memories in this album
        $memStmt = $pdo->prepare("SELECT * FROM memories WHERE album_id = ? AND user_id = ? ORDER BY memory_date DESC");
        $memStmt->execute([$id, $userId]);
        $memories = $memStmt->fetchAll();

        foreach ($memories as &$m) {
            $m['formatted_size'] = formatBytes($m['file_size']);
        }

        $album['memories'] = $memories;
        jsonResponse(['album' => $album]);
        break;

    case 'create':
        if ($method !== 'POST') {
            jsonResponse(['error' => 'Phương thức không hợp lệ.'], 405);
        }

        $title = trim($input['title'] ?? '');
        $description = trim($input['description'] ?? '');
        $coverUrl = trim($input['cover_url'] ?? '');
        $category = trim($input['category'] ?? 'Gia đình');

        if (empty($title)) {
            jsonResponse(['error' => 'Vui lòng nhập tên album.'], 422);
        }

        // Handle uploaded cover if any
        if (isset($_FILES['cover_file']) && $_FILES['cover_file']['error'] === UPLOAD_ERR_OK) {
            $file = $_FILES['cover_file'];
            $ext = strtolower(pathinfo($file['name'], PATHINFO_EXTENSION));
            if (in_array($ext, ['jpg', 'jpeg', 'png', 'webp'])) {
                $coverName = 'album_cover_' . $userId . '_' . time() . '.' . $ext;
                $destDir = __DIR__ . '/../uploads/photos/';
                if (move_uploaded_file($file['tmp_name'], $destDir . $coverName)) {
                    $coverUrl = 'uploads/photos/' . $coverName;
                }
            }
        }

        if (empty($coverUrl)) {
            $coverUrl = 'https://images.unsplash.com/photo-1506744038136-46273834b3fb?w=800&auto=format&fit=crop&q=80';
        }

        $stmt = $pdo->prepare("INSERT INTO albums (user_id, title, description, cover_url, category) VALUES (?, ?, ?, ?, ?)");
        $stmt->execute([$userId, $title, $description, $coverUrl, $category]);
        $albumId = $pdo->lastInsertId();

        // Optional: assign selected memory IDs
        if (!empty($input['memory_ids']) && is_array($input['memory_ids'])) {
            $mIds = array_map('intval', $input['memory_ids']);
            $inClause = implode(',', $mIds);
            $pdo->prepare("UPDATE memories SET album_id = ? WHERE user_id = ? AND id IN ($inClause)")->execute([$albumId, $userId]);
        }

        logActivity($userId, 'CREATE_ALBUM', "Tạo album mới: $title");

        jsonResponse([
            'message' => 'Tạo album thành công!',
            'album_id' => $albumId
        ], 201);
        break;

    case 'update':
        if ($method !== 'POST') {
            jsonResponse(['error' => 'Phương thức không hợp lệ.'], 405);
        }

        $id = (int)($input['id'] ?? 0);
        $title = trim($input['title'] ?? '');
        $description = trim($input['description'] ?? '');
        $coverUrl = trim($input['cover_url'] ?? '');
        $category = trim($input['category'] ?? '');

        if (empty($title)) {
            jsonResponse(['error' => 'Vui lòng nhập tên album.'], 422);
        }

        // Verify ownership
        $stmt = $pdo->prepare("SELECT id FROM albums WHERE id = ? AND user_id = ?");
        $stmt->execute([$id, $userId]);
        if (!$stmt->fetch()) {
            jsonResponse(['error' => 'Không tìm thấy album để cập nhật.'], 404);
        }

        // Handle uploaded cover if any
        if (isset($_FILES['cover_file']) && $_FILES['cover_file']['error'] === UPLOAD_ERR_OK) {
            $file = $_FILES['cover_file'];
            $ext = strtolower(pathinfo($file['name'], PATHINFO_EXTENSION));
            if (in_array($ext, ['jpg', 'jpeg', 'png', 'webp'])) {
                $coverName = 'album_cover_' . $userId . '_' . time() . '.' . $ext;
                $destDir = __DIR__ . '/../uploads/photos/';
                if (move_uploaded_file($file['tmp_name'], $destDir . $coverName)) {
                    $coverUrl = 'uploads/photos/' . $coverName;
                }
            }
        }

        $updateFields = ["title = ?", "description = ?", "category = ?", "updated_at = CURRENT_TIMESTAMP"];
        $updateParams = [$title, $description, $category];

        if (!empty($coverUrl)) {
            $updateFields[] = "cover_url = ?";
            $updateParams[] = $coverUrl;
        }

        $updateParams[] = $id;
        $updateParams[] = $userId;

        $sql = "UPDATE albums SET " . implode(", ", $updateFields) . " WHERE id = ? AND user_id = ?";
        $pdo->prepare($sql)->execute($updateParams);

        logActivity($userId, 'UPDATE_ALBUM', "Cập nhật album #$id: $title");

        jsonResponse(['message' => 'Cập nhật album thành công!']);
        break;

    case 'delete':
        if ($method !== 'POST') {
            jsonResponse(['error' => 'Phương thức không hợp lệ.'], 405);
        }

        $id = (int)($input['id'] ?? 0);
        $stmt = $pdo->prepare("SELECT title FROM albums WHERE id = ? AND user_id = ?");
        $stmt->execute([$id, $userId]);
        $row = $stmt->fetch();

        if (!$row) {
            jsonResponse(['error' => 'Không tìm thấy album để xóa.'], 404);
        }

        // Unlink memories from album without deleting original files/memories
        $unlink = $pdo->prepare("UPDATE memories SET album_id = NULL WHERE album_id = ? AND user_id = ?");
        $unlink->execute([$id, $userId]);

        $del = $pdo->prepare("DELETE FROM albums WHERE id = ? AND user_id = ?");
        $del->execute([$id, $userId]);

        logActivity($userId, 'DELETE_ALBUM', "Đã xóa album: " . $row['title']);

        jsonResponse(['message' => 'Đã xóa album thành công (các hình ảnh và video vẫn được giữ an toàn trong thư viện)!']);
        break;

    default:
        jsonResponse(['error' => 'Action không tồn tại.'], 404);
}

