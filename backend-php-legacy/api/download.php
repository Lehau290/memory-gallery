<?php
/**
 * MEMORY GALLERY - File Downloader & Batch Zip Exporter
 * /api/download.php
 */

require_once __DIR__ . '/../config/helpers.php';

$pdo = Database::getConnection();
$user = requireAuth();
$userId = $user['id'];

$id = isset($_GET['id']) ? (int)$_GET['id'] : 0;
$ids = isset($_GET['ids']) ? explode(',', $_GET['ids']) : [];

// Single File Download
if ($id > 0) {
    $stmt = $pdo->prepare("SELECT title, file_path, file_name, mime_type, file_size FROM memories WHERE id = ? AND user_id = ?");
    $stmt->execute([$id, $userId]);
    $memory = $stmt->fetch();

    if (!$memory) {
        http_response_code(404);
        die("Không tìm thấy tệp kỷ niệm.");
    }

    $filePath = $memory['file_path'];

    // Remote URL redirect
    if (str_starts_with($filePath, 'http://') || str_starts_with($filePath, 'https://')) {
        header("Location: " . $filePath);
        exit;
    }

    $localPath = __DIR__ . '/../' . $filePath;
    if (!file_exists($localPath)) {
        http_response_code(404);
        die("Tệp không tồn tại trên máy chủ.");
    }

    $downloadName = !empty($memory['file_name']) ? $memory['file_name'] : basename($localPath);

    header('Content-Description: File Transfer');
    header('Content-Type: ' . ($memory['mime_type'] ?: 'application/octet-stream'));
    header('Content-Disposition: attachment; filename="' . $downloadName . '"');
    header('Expires: 0');
    header('Cache-Control: must-revalidate');
    header('Pragma: public');
    header('Content-Length: ' . filesize($localPath));
    readfile($localPath);
    exit;
}

// Batch ZIP Download
if (!empty($ids)) {
    $cleanIds = array_map('intval', array_filter($ids));
    if (empty($cleanIds)) {
        die("Vui lòng chọn các kỷ niệm muốn tải.");
    }

    $inClause = implode(',', $cleanIds);
    $stmt = $pdo->prepare("SELECT id, title, file_path, file_name FROM memories WHERE user_id = ? AND id IN ($inClause)");
    $stmt->execute([$userId]);
    $items = $stmt->fetchAll();

    if (empty($items)) {
        die("Không tìm thấy kỷ niệm hợp lệ.");
    }

    if (class_exists('ZipArchive')) {
        $zip = new ZipArchive();
        $zipName = 'MemoryGallery_' . date('Ymd_His') . '.zip';
        $tempZip = sys_get_temp_dir() . '/' . $zipName;

        if ($zip->open($tempZip, ZipArchive::CREATE | ZipArchive::OVERWRITE) === TRUE) {
            foreach ($items as $item) {
                $p = $item['file_path'];
                if (str_starts_with($p, 'http://') || str_starts_with($p, 'https://')) {
                    // For remote files, fetch content
                    $content = @file_get_contents($p);
                    if ($content) {
                        $zip->addFromString($item['file_name'] ?: ('memory_' . $item['id'] . '.jpg'), $content);
                    }
                } else {
                    $local = __DIR__ . '/../' . $p;
                    if (file_exists($local)) {
                        $zip->addFile($local, $item['file_name'] ?: basename($local));
                    }
                }
            }
            $zip->close();

            if (file_exists($tempZip)) {
                header('Content-Type: application/zip');
                header('Content-Disposition: attachment; filename="' . $zipName . '"');
                header('Content-Length: ' . filesize($tempZip));
                readfile($tempZip);
                @unlink($tempZip);
                exit;
            }
        }
    }

    die("Tính năng nén Zip tạm thời không khả dụng.");
}

http_response_code(400);
echo "Tham số không hợp lệ.";

