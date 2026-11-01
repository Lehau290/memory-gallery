<?php
/**
 * MEMORY GALLERY - Helper Functions & Auth Utilities
 */

require_once __DIR__ . '/database.php';

function jsonResponse($data, $statusCode = 200) {
    if (!headers_sent()) {
        http_response_code($statusCode);
        header('Content-Type: application/json; charset=utf-8');
    }
    echo json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    if (empty($GLOBALS['TEST_MODE'])) {
        exit;
    }
}

function getCurrentUser() {
    if (session_status() === PHP_SESSION_NONE && php_sapi_name() !== 'cli') {
        @session_start();
    }

    $userId = $_SESSION['user_id'] ?? null;

    // Also support Authorization: Bearer <user_id> for simple API testing
    if (!$userId) {
        $headers = getallheaders_custom();
        if (isset($headers['Authorization']) && preg_match('/Bearer\s+(\d+)/i', $headers['Authorization'], $matches)) {
            $userId = (int)$matches[1];
        }
    }

    if (!$userId) {
        return null;
    }

    $pdo = Database::getConnection();
    $stmt = $pdo->prepare("SELECT id, username, email, full_name, avatar_url, bio, role, status, storage_quota, used_storage, created_at FROM users WHERE id = ?");
    $stmt->execute([$userId]);
    $user = $stmt->fetch();

    if ($user && $user['status'] === 'active') {
        return $user;
    }

    return null;
}

function requireAuth() {
    $user = getCurrentUser();
    if (!$user) {
        jsonResponse(['error' => 'Bạn cần đăng nhập để thực hiện thao tác này.'], 401);
    }
    return $user;
}

function requireAdmin() {
    $user = requireAuth();
    if ($user['role'] !== 'admin') {
        jsonResponse(['error' => 'Bạn không có quyền truy cập khu vực quản trị.'], 403);
    }
    return $user;
}

function logActivity($userId, $action, $details = '') {
    try {
        $pdo = Database::getConnection();
        $ip = $_SERVER['REMOTE_ADDR'] ?? '127.0.0.1';
        $stmt = $pdo->prepare("INSERT INTO activity_logs (user_id, action, details, ip_address) VALUES (?, ?, ?, ?)");
        $stmt->execute([$userId, $action, $details, $ip]);
    } catch (Exception $e) {
        // Silently ignore logging failure
    }
}

function formatBytes($bytes, $precision = 1) {
    $units = ['B', 'KB', 'MB', 'GB', 'TB'];
    $bytes = max($bytes, 0);
    $pow = floor(($bytes ? log($bytes) : 0) / log(1024));
    $pow = min($pow, count($units) - 1);
    $bytes /= pow(1024, $pow);
    return round($bytes, $precision) . ' ' . $units[$pow];
}

function updateUserStorage($userId) {
    $pdo = Database::getConnection();
    $stmt = $pdo->prepare("SELECT SUM(file_size) as total FROM memories WHERE user_id = ?");
    $stmt->execute([$userId]);
    $total = (int)$stmt->fetchColumn();

    $update = $pdo->prepare("UPDATE users SET used_storage = ? WHERE id = ?");
    $update->execute([$total, $userId]);
    return $total;
}

function getallheaders_custom() {
    if (function_exists('getallheaders')) {
        return getallheaders();
    }
    $headers = [];
    foreach ($_SERVER as $name => $value) {
        if (substr($name, 0, 5) == 'HTTP_') {
            $headers[str_replace(' ', '-', ucwords(strtolower(str_replace('_', ' ', substr($name, 5)))))] = $value;
        }
    }
    return $headers;
}
