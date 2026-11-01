<?php
/**
 * MEMORY GALLERY - Video Streaming with HTTP 206 Range Support
 * /api/stream.php
 */

require_once __DIR__ . '/../config/helpers.php';

$pdo = Database::getConnection();
$user = requireAuth();
$userId = $user['id'];

$id = (int)($_GET['id'] ?? 0);
$stmt = $pdo->prepare("SELECT file_path, mime_type, file_size FROM memories WHERE id = ? AND user_id = ?");
$stmt->execute([$id, $userId]);
$video = $stmt->fetch();

if (!$video) {
    http_response_code(404);
    die("Không tìm thấy video.");
}

$filePath = $video['file_path'];

if (str_starts_with($filePath, 'http://') || str_starts_with($filePath, 'https://')) {
    header("Location: " . $filePath);
    exit;
}

$localPath = __DIR__ . '/../' . $filePath;
if (!file_exists($localPath)) {
    http_response_code(404);
    die("Tệp video không tồn tại.");
}

$size = filesize($localPath);
$length = $size;
$start = 0;
$end = $size - 1;

$mime = $video['mime_type'] ?: 'video/mp4';

header("Content-Type: " . $mime);
header("Accept-Ranges: bytes");

if (isset($_SERVER['HTTP_RANGE'])) {
    $c_start = $start;
    $c_end = $end;

    list(, $range) = explode('=', $_SERVER['HTTP_RANGE'], 2);
    if (strpos($range, ',') !== false) {
        header('HTTP/1.1 416 Requested Range Not Satisfiable');
        header("Content-Range: bytes $start-$end/$size");
        exit;
    }

    if ($range == '-') {
        $c_start = $size - substr($range, 1);
    } else {
        $range = explode('-', $range);
        $c_start = $range[0];
        $c_end = (isset($range[1]) && is_numeric($range[1])) ? $range[1] : $size - 1;
    }
    $c_end = ($c_end > $end) ? $end : $c_end;

    if ($c_start > $c_end || $c_start > $size - 1 || $c_end >= $size) {
        header('HTTP/1.1 416 Requested Range Not Satisfiable');
        header("Content-Range: bytes $start-$end/$size");
        exit;
    }

    $start = $c_start;
    $end = $c_end;
    $length = $end - $start + 1;

    header('HTTP/1.1 206 Partial Content');
    header("Content-Range: bytes $start-$end/$size");
}

header("Content-Length: " . $length);

$fp = fopen($localPath, 'rb');
fseek($fp, $start);
$buffer = 1024 * 64;

while (!feof($fp) && ($pos = ftell($fp)) <= $end) {
    if ($pos + $buffer > $end) {
        $buffer = $end - $pos + 1;
    }
    echo fread($fp, $buffer);
    flush();
}
fclose($fp);
exit;

