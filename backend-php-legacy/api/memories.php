<?php
/**
 * MEMORY GALLERY - Memories API
 * /api/memories.php
 */

require_once __DIR__ . '/../config/helpers.php';

$pdo = Database::getConnection();
$user = requireAuth();
$userId = $user['id'];

$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
$action = $_GET['action'] ?? ($method === 'POST' ? 'create' : 'list');

// Read JSON input if sent
$rawInput = file_get_contents('php://input');
$jsonBody = json_decode($rawInput, true) ?? [];
$input = array_merge($_POST, $jsonBody);

switch ($action) {
    case 'list':
        $search     = trim($_GET['search'] ?? '');
        $type       = trim($_GET['type'] ?? 'all'); // 'image', 'video', 'all'
        $albumId    = isset($_GET['album_id']) && $_GET['album_id'] !== '' ? (int)$_GET['album_id'] : null;
        $isFavorite = isset($_GET['favorite']) ? (int)$_GET['favorite'] : null;
        $year       = isset($_GET['year']) && !empty($_GET['year']) ? (int)$_GET['year'] : null;
        $sort       = trim($_GET['sort'] ?? 'memory_date_desc');

        $where = ["m.user_id = ?"];
        $params = [$userId];

        if ($type === 'image' || $type === 'video') {
            $where[] = "m.file_type = ?";
            $params[] = $type;
        }

        if ($albumId !== null) {
            $where[] = "m.album_id = ?";
            $params[] = $albumId;
        }

        if ($isFavorite !== null) {
            $where[] = "m.is_favorite = ?";
            $params[] = $isFavorite;
        }

        if ($year !== null) {
            $where[] = "strftime('%Y', m.memory_date) = ? OR m.memory_date LIKE ?";
            $params[] = (string)$year;
            $params[] = $year . '-%';
        }

        if (!empty($search)) {
            $searchTerm = '%' . $search . '%';
            $where[] = "(m.title LIKE ? OR m.description LIKE ? OR m.location LIKE ? OR a.title LIKE ? OR EXISTS (
                SELECT 1 FROM memory_tags mt 
                JOIN tags t ON mt.tag_id = t.id 
                WHERE mt.memory_id = m.id AND t.name LIKE ?
            ))";
            $params[] = $searchTerm;
            $params[] = $searchTerm;
            $params[] = $searchTerm;
            $params[] = $searchTerm;
            $params[] = $searchTerm;
        }

        $orderBy = "m.memory_date DESC, m.id DESC";
        if ($sort === 'memory_date_asc') {
            $orderBy = "m.memory_date ASC, m.id ASC";
        } elseif ($sort === 'created_at_desc') {
            $orderBy = "m.created_at DESC";
        } elseif ($sort === 'title_asc') {
            $orderBy = "m.title ASC";
        }

        $sql = "SELECT m.*, a.title as album_title 
                FROM memories m 
                LEFT JOIN albums a ON m.album_id = a.id 
                WHERE " . implode(" AND ", $where) . " 
                ORDER BY " . $orderBy;

        $stmt = $pdo->prepare($sql);
        $stmt->execute($params);
        $memories = $stmt->fetchAll();

        // Attach tags to each memory
        if (!empty($memories)) {
            $memoryIds = array_column($memories, 'id');
            $placeholders = implode(',', array_fill(0, count($memoryIds), '?'));
            $tagStmt = $pdo->prepare("SELECT mt.memory_id, t.id as tag_id, t.name as tag_name 
                                      FROM memory_tags mt 
                                      JOIN tags t ON mt.tag_id = t.id 
                                      WHERE mt.memory_id IN ($placeholders)");
            $tagStmt->execute($memoryIds);
            $tagsByMemory = [];
            while ($row = $tagStmt->fetch()) {
                $tagsByMemory[$row['memory_id']][] = [
                    'id' => $row['tag_id'],
                    'name' => $row['tag_name']
                ];
            }

            foreach ($memories as &$mem) {
                $mem['tags'] = $tagsByMemory[$mem['id']] ?? [];
                $mem['formatted_size'] = formatBytes($mem['file_size']);
            }
        }

        jsonResponse([
            'count' => count($memories),
            'memories' => $memories
        ]);
        break;

    case 'get':
        $id = (int)($_GET['id'] ?? 0);
        $stmt = $pdo->prepare("SELECT m.*, a.title as album_title 
                               FROM memories m 
                               LEFT JOIN albums a ON m.album_id = a.id 
                               WHERE m.id = ? AND m.user_id = ?");
        $stmt->execute([$id, $userId]);
        $memory = $stmt->fetch();

        if (!$memory) {
            jsonResponse(['error' => 'Không tìm thấy kỷ niệm này.'], 404);
        }

        // Get tags
        $tagStmt = $pdo->prepare("SELECT t.id, t.name FROM memory_tags mt JOIN tags t ON mt.tag_id = t.id WHERE mt.memory_id = ?");
        $tagStmt->execute([$id]);
        $memory['tags'] = $tagStmt->fetchAll();
        $memory['formatted_size'] = formatBytes($memory['file_size']);

        jsonResponse(['memory' => $memory]);
        break;

    case 'upload':
    case 'create':
        if ($method !== 'POST') {
            jsonResponse(['error' => 'Phương thức không hợp lệ.'], 405);
        }

        // Check if files were uploaded
        $uploadedResults = [];
        $allowedImageMimes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
        $allowedVideoMimes = ['video/mp4', 'video/webm', 'video/quicktime'];
        $maxFileSize = 100 * 1024 * 1024; // 100 MB

        // Normalize multiple files format
        $filesToProcess = [];
        if (isset($_FILES['files'])) {
            $rawFiles = $_FILES['files'];
            if (is_array($rawFiles['name'])) {
                for ($i = 0; $i < count($rawFiles['name']); $i++) {
                    if ($rawFiles['error'][$i] === UPLOAD_ERR_OK) {
                        $filesToProcess[] = [
                            'name'     => $rawFiles['name'][$i],
                            'type'     => $rawFiles['type'][$i],
                            'tmp_name' => $rawFiles['tmp_name'][$i],
                            'error'    => $rawFiles['error'][$i],
                            'size'     => $rawFiles['size'][$i],
                        ];
                    }
                }
            } else if ($rawFiles['error'] === UPLOAD_ERR_OK) {
                $filesToProcess[] = $rawFiles;
            }
        } elseif (isset($_FILES['file']) && $_FILES['file']['error'] === UPLOAD_ERR_OK) {
            $filesToProcess[] = $_FILES['file'];
        }

        // Shared metadata
        $titlePrefix = trim($input['title'] ?? '');
        $description = trim($input['description'] ?? '');
        $memoryDate  = trim($input['memory_date'] ?? date('Y-m-d'));
        $location    = trim($input['location'] ?? '');
        $albumId     = !empty($input['album_id']) ? (int)$input['album_id'] : null;
        $privacy     = in_array($input['privacy'] ?? '', ['private', 'shared']) ? $input['privacy'] : 'private';
        $tagsString  = trim($input['tags'] ?? ''); // e.g. "Du lịch, Đà Lạt, Gia đình" or JSON array

        // Parse tags
        $tagNames = [];
        if (!empty($tagsString)) {
            if (str_starts_with($tagsString, '[')) {
                $tagNames = json_decode($tagsString, true) ?: [];
            } else {
                $tagNames = array_map('trim', explode(',', $tagsString));
            }
            $tagNames = array_unique(array_filter($tagNames));
        }

        if (empty($filesToProcess)) {
            // Also allow creating memory via external URL for testing
            $fileUrl = trim($input['file_url'] ?? '');
            if (!empty($fileUrl)) {
                $fileType = (str_ends_with(strtolower($fileUrl), '.mp4') || str_ends_with(strtolower($fileUrl), '.webm')) ? 'video' : 'image';
                $title = !empty($titlePrefix) ? $titlePrefix : 'Kỷ niệm mới';
                $mimeType = $fileType === 'video' ? 'video/mp4' : 'image/jpeg';
                $fileSize = 1024 * 1024 * 3; // Approx 3MB

                $ins = $pdo->prepare("INSERT INTO memories (user_id, album_id, title, description, file_path, file_name, file_type, mime_type, file_size, memory_date, location, is_favorite, privacy) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?)");
                $ins->execute([$userId, $albumId, $title, $description, $fileUrl, basename($fileUrl), $fileType, $mimeType, $fileSize, $memoryDate, $location, $privacy]);
                $memId = $pdo->lastInsertId();

                saveTagsForMemory($pdo, $userId, $memId, $tagNames);
                updateUserStorage($userId);
                logActivity($userId, 'UPLOAD_URL', "Thêm kỷ niệm từ link: $title");

                jsonResponse([
                    'message' => 'Đã lưu kỷ niệm thành công!',
                    'memory_id' => $memId
                ], 201);
            }

            jsonResponse(['error' => 'Vui lòng chọn ít nhất một hình ảnh hoặc video để tải lên.'], 422);
        }

        $photoDir = __DIR__ . '/../uploads/photos/';
        $videoDir = __DIR__ . '/../uploads/videos/';
        if (!is_dir($photoDir)) mkdir($photoDir, 0777, true);
        if (!is_dir($videoDir)) mkdir($videoDir, 0777, true);

        $insertedCount = 0;
        foreach ($filesToProcess as $index => $file) {
            if ($file['size'] > $maxFileSize) {
                continue; // Skip file if oversized
            }

            // Detect MIME type reliably
            $finfo = finfo_open(FILEINFO_MIME_TYPE);
            $mime = finfo_file($finfo, $file['tmp_name']);
            finfo_close($finfo);

            $isImage = in_array($mime, $allowedImageMimes);
            $isVideo = in_array($mime, $allowedVideoMimes);

            if (!$isImage && !$isVideo) {
                // Check extension fallback
                $ext = strtolower(pathinfo($file['name'], PATHINFO_EXTENSION));
                if (in_array($ext, ['jpg', 'jpeg', 'png', 'webp', 'gif'])) {
                    $isImage = true;
                    $mime = 'image/' . ($ext === 'jpg' ? 'jpeg' : $ext);
                } elseif (in_array($ext, ['mp4', 'webm', 'mov'])) {
                    $isVideo = true;
                    $mime = 'video/' . ($ext === 'mov' ? 'quicktime' : $ext);
                } else {
                    continue; // Skip invalid formats
                }
            }

            $fileType = $isImage ? 'image' : 'video';
            $ext = strtolower(pathinfo($file['name'], PATHINFO_EXTENSION)) ?: ($isImage ? 'jpg' : 'mp4');
            $uniqueName = 'mem_' . $userId . '_' . time() . '_' . bin2hex(random_bytes(4)) . '.' . $ext;
            $destPath = ($isImage ? $photoDir : $videoDir) . $uniqueName;

            if (move_uploaded_file($file['tmp_name'], $destPath)) {
                $relativeFilePath = 'uploads/' . ($isImage ? 'photos/' : 'videos/') . $uniqueName;
                $originalName = pathinfo($file['name'], PATHINFO_FILENAME);
                
                // If titlePrefix given, append index if multiple
                if (!empty($titlePrefix)) {
                    $memTitle = count($filesToProcess) > 1 ? ($titlePrefix . ' (' . ($index + 1) . ')') : $titlePrefix;
                } else {
                    $memTitle = ucwords(str_replace(['_', '-'], ' ', $originalName));
                }

                $stmt = $pdo->prepare("INSERT INTO memories (user_id, album_id, title, description, file_path, file_name, file_type, mime_type, file_size, memory_date, location, is_favorite, privacy) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?)");
                $stmt->execute([
                    $userId,
                    $albumId,
                    $memTitle,
                    $description,
                    $relativeFilePath,
                    $file['name'],
                    $fileType,
                    $mime,
                    $file['size'],
                    $memoryDate,
                    $location,
                    $privacy
                ]);

                $memId = $pdo->lastInsertId();
                saveTagsForMemory($pdo, $userId, $memId, $tagNames);
                $insertedCount++;

                $uploadedResults[] = [
                    'id' => $memId,
                    'title' => $memTitle,
                    'file_path' => $relativeFilePath,
                    'file_type' => $fileType
                ];
            }
        }

        updateUserStorage($userId);
        logActivity($userId, 'UPLOAD', "Đã tải lên $insertedCount file kỷ niệm");

        jsonResponse([
            'message' => "Tải lên thành công $insertedCount kỷ niệm!",
            'uploaded' => $uploadedResults
        ], 201);
        break;

    case 'update':
        if ($method !== 'POST') {
            jsonResponse(['error' => 'Phương thức không hợp lệ.'], 405);
        }

        $id = (int)($input['id'] ?? 0);
        $stmt = $pdo->prepare("SELECT id FROM memories WHERE id = ? AND user_id = ?");
        $stmt->execute([$id, $userId]);
        if (!$stmt->fetch()) {
            jsonResponse(['error' => 'Không tìm thấy kỷ niệm để cập nhật.'], 404);
        }

        $title = trim($input['title'] ?? '');
        $description = trim($input['description'] ?? '');
        $memoryDate  = trim($input['memory_date'] ?? '');
        $location    = trim($input['location'] ?? '');
        $albumId     = isset($input['album_id']) && $input['album_id'] !== '' ? (int)$input['album_id'] : null;
        $privacy     = in_array($input['privacy'] ?? '', ['private', 'shared']) ? $input['privacy'] : 'private';

        if (empty($title)) {
            jsonResponse(['error' => 'Tên kỷ niệm không được để trống.'], 422);
        }

        $up = $pdo->prepare("UPDATE memories SET title = ?, description = ?, memory_date = ?, location = ?, album_id = ?, privacy = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND user_id = ?");
        $up->execute([$title, $description, $memoryDate, $location, $albumId, $privacy, $id, $userId]);

        // Update tags
        if (isset($input['tags'])) {
            $tagNames = is_array($input['tags']) ? $input['tags'] : array_map('trim', explode(',', (string)$input['tags']));
            $tagNames = array_unique(array_filter($tagNames));
            saveTagsForMemory($pdo, $userId, $id, $tagNames, true);
        }

        logActivity($userId, 'UPDATE_MEMORY', "Cập nhật thông tin kỷ niệm #$id: $title");

        jsonResponse(['message' => 'Cập nhật thông tin kỷ niệm thành công!']);
        break;

    case 'toggle_favorite':
        if ($method !== 'POST') {
            jsonResponse(['error' => 'Phương thức không hợp lệ.'], 405);
        }

        $id = (int)($input['id'] ?? 0);
        $stmt = $pdo->prepare("SELECT is_favorite, title FROM memories WHERE id = ? AND user_id = ?");
        $stmt->execute([$id, $userId]);
        $row = $stmt->fetch();

        if (!$row) {
            jsonResponse(['error' => 'Không tìm thấy kỷ niệm.'], 404);
        }

        $newFav = $row['is_favorite'] ? 0 : 1;
        $up = $pdo->prepare("UPDATE memories SET is_favorite = ? WHERE id = ? AND user_id = ?");
        $up->execute([$newFav, $id, $userId]);

        jsonResponse([
            'message' => $newFav ? 'Đã thêm vào mục yêu thích!' : 'Đã xóa khỏi mục yêu thích.',
            'is_favorite' => $newFav
        ]);
        break;

    case 'delete':
        if ($method !== 'POST') {
            jsonResponse(['error' => 'Phương thức không hợp lệ.'], 405);
        }

        $id = (int)($input['id'] ?? 0);
        $stmt = $pdo->prepare("SELECT file_path, title FROM memories WHERE id = ? AND user_id = ?");
        $stmt->execute([$id, $userId]);
        $row = $stmt->fetch();

        if (!$row) {
            jsonResponse(['error' => 'Không tìm thấy kỷ niệm để xóa.'], 404);
        }

        // Delete physical file if within uploads directory
        $filePath = __DIR__ . '/../' . $row['file_path'];
        if (str_starts_with($row['file_path'], 'uploads/') && file_exists($filePath)) {
            @unlink($filePath);
        }

        $del = $pdo->prepare("DELETE FROM memories WHERE id = ? AND user_id = ?");
        $del->execute([$id, $userId]);

        updateUserStorage($userId);
        logActivity($userId, 'DELETE_MEMORY', "Đã xóa kỷ niệm: " . $row['title']);

        jsonResponse(['message' => 'Đã xóa kỷ niệm thành công!']);
        break;

    case 'batch':
        if ($method !== 'POST') {
            jsonResponse(['error' => 'Phương thức không hợp lệ.'], 405);
        }

        $operation = $input['operation'] ?? ''; // 'delete', 'add_to_album', 'toggle_favorite'
        $ids = $input['ids'] ?? [];

        if (empty($ids) || !is_array($ids)) {
            jsonResponse(['error' => 'Vui lòng chọn ít nhất một kỷ niệm.'], 422);
        }

        $sanitizedIds = array_map('intval', $ids);
        $inClause = implode(',', $sanitizedIds);

        if ($operation === 'delete') {
            $stmt = $pdo->prepare("SELECT id, file_path FROM memories WHERE user_id = ? AND id IN ($inClause)");
            $stmt->execute([$userId]);
            $toDelete = $stmt->fetchAll();

            foreach ($toDelete as $item) {
                $filePath = __DIR__ . '/../' . $item['file_path'];
                if (str_starts_with($item['file_path'], 'uploads/') && file_exists($filePath)) {
                    @unlink($filePath);
                }
            }

            $pdo->prepare("DELETE FROM memories WHERE user_id = ? AND id IN ($inClause)")->execute([$userId]);
            updateUserStorage($userId);
            logActivity($userId, 'BATCH_DELETE', "Xóa hàng loạt " . count($toDelete) . " kỷ niệm");

            jsonResponse(['message' => 'Đã xóa các kỷ niệm đã chọn!']);
        } elseif ($operation === 'add_to_album') {
            $targetAlbumId = (int)($input['album_id'] ?? 0);
            $stmt = $pdo->prepare("UPDATE memories SET album_id = ? WHERE user_id = ? AND id IN ($inClause)");
            $stmt->execute([$targetAlbumId ?: null, $userId]);

            jsonResponse(['message' => 'Đã chuyển các kỷ niệm vào album!']);
        }

        jsonResponse(['error' => 'Thao tác không hỗ trợ.'], 400);
        break;

    default:
        jsonResponse(['error' => 'Action không tồn tại.'], 404);
}

function saveTagsForMemory(PDO $pdo, $userId, $memoryId, array $tags, $replace = false) {
    if ($replace) {
        $del = $pdo->prepare("DELETE FROM memory_tags WHERE memory_id = ?");
        $del->execute([$memoryId]);
    }

    if (empty($tags)) return;

    $findTag = $pdo->prepare("SELECT id FROM tags WHERE user_id = ? AND name = ?");
    $insertTag = $pdo->prepare("INSERT INTO tags (user_id, name) VALUES (?, ?)");
    $linkTag = $pdo->prepare("INSERT OR IGNORE INTO memory_tags (memory_id, tag_id) VALUES (?, ?)");

    foreach ($tags as $tagName) {
        $tagName = trim($tagName);
        if (empty($tagName)) continue;

        $findTag->execute([$userId, $tagName]);
        $tagId = $findTag->fetchColumn();

        if (!$tagId) {
            $insertTag->execute([$userId, $tagName]);
            $tagId = $pdo->lastInsertId();
        }

        $linkTag->execute([$memoryId, $tagId]);
    }
}

