<?php
/**
 * MEMORY GALLERY - Authentication API
 * /api/auth.php
 */

require_once __DIR__ . '/../config/helpers.php';

$pdo = Database::getConnection();
$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
$action = $_GET['action'] ?? ($method === 'POST' ? 'login' : 'me');

// Read JSON input if sent
$rawInput = file_get_contents('php://input');
$jsonBody = json_decode($rawInput, true) ?? [];
$input = array_merge($_POST, $jsonBody);

switch ($action) {
    case 'login':
        if ($method !== 'POST') {
            jsonResponse(['error' => 'Phương thức không hợp lệ.'], 405);
        }

        $identity = trim($input['identity'] ?? $input['email'] ?? '');
        $password = trim($input['password'] ?? '');

        if (empty($identity) || empty($password)) {
            jsonResponse(['error' => 'Vui lòng nhập email/tên đăng nhập và mật khẩu.'], 422);
        }

        $stmt = $pdo->prepare("SELECT * FROM users WHERE email = ? OR username = ?");
        $stmt->execute([$identity, $identity]);
        $user = $stmt->fetch();

        if (!$user || !password_verify($password, $user['password_hash'])) {
            jsonResponse(['error' => 'Tài khoản hoặc mật khẩu không chính xác.'], 401);
        }

        if ($user['status'] === 'suspended') {
            jsonResponse(['error' => 'Tài khoản của bạn đã bị khóa. Vui lòng liên hệ quản trị viên.'], 403);
        }

        $_SESSION['user_id'] = $user['id'];
        logActivity($user['id'], 'LOGIN', 'Đăng nhập thành công');

        unset($user['password_hash']);
        jsonResponse([
            'message' => 'Đăng nhập thành công!',
            'user' => $user,
            'token' => (string)$user['id'] // Simple token for header fallback
        ]);
        break;

    case 'register':
        if ($method !== 'POST') {
            jsonResponse(['error' => 'Phương thức không hợp lệ.'], 405);
        }

        $fullName = trim($input['full_name'] ?? '');
        $username = strtolower(trim($input['username'] ?? ''));
        $email    = strtolower(trim($input['email'] ?? ''));
        $password = $input['password'] ?? '';
        $confirmPassword = $input['confirm_password'] ?? '';
        $avatarUrl = trim($input['avatar_url'] ?? '');

        if (empty($fullName) || empty($username) || empty($email) || empty($password)) {
            jsonResponse(['error' => 'Vui lòng điền đầy đủ các thông tin bắt buộc.'], 422);
        }

        if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
            jsonResponse(['error' => 'Địa chỉ email không hợp lệ.'], 422);
        }

        if (strlen($username) < 3 || !preg_match('/^[a-zA-Z0-9_]+$/', $username)) {
            jsonResponse(['error' => 'Tên đăng nhập tối thiểu 3 ký tự và chỉ chứa chữ cái, số, dấu gạch dưới.'], 422);
        }

        if (strlen($password) < 6) {
            jsonResponse(['error' => 'Mật khẩu phải có độ dài tối thiểu 6 ký tự.'], 422);
        }

        if ($password !== $confirmPassword) {
            jsonResponse(['error' => 'Mật khẩu xác nhận không khớp.'], 422);
        }

        // Check if email or username exists
        $stmt = $pdo->prepare("SELECT id FROM users WHERE email = ?");
        $stmt->execute([$email]);
        if ($stmt->fetch()) {
            jsonResponse(['error' => 'Địa chỉ email này đã được đăng ký.'], 409);
        }

        $stmt = $pdo->prepare("SELECT id FROM users WHERE username = ?");
        $stmt->execute([$username]);
        if ($stmt->fetch()) {
            jsonResponse(['error' => 'Tên đăng nhập này đã có người sử dụng.'], 409);
        }

        // Default avatar if not provided
        if (empty($avatarUrl)) {
            $avatarUrl = 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=400&auto=format&fit=crop&q=80';
        }

        $passwordHash = password_hash($password, PASSWORD_BCRYPT);
        $quota = 21474836480; // 20 GB

        $insert = $pdo->prepare("INSERT INTO users (username, email, password_hash, full_name, avatar_url, bio, role, status, storage_quota, used_storage) VALUES (?, ?, ?, ?, ?, ?, 'user', 'active', ?, 0)");
        $insert->execute([$username, $email, $passwordHash, $fullName, $avatarUrl, 'Chào bạn, tôi đang lưu giữ những kỷ niệm quý giá tại Memory Gallery!', $quota]);

        $newUserId = $pdo->lastInsertId();
        $_SESSION['user_id'] = $newUserId;

        // Create default starter albums
        $initAlbum = $pdo->prepare("INSERT INTO albums (user_id, title, description, cover_url, category) VALUES (?, ?, ?, ?, ?)");
        $initAlbum->execute([$newUserId, 'Khoảnh khắc thường ngày', 'Những bức ảnh và video đời thường bình dị nhưng đáng nhớ.', 'https://images.unsplash.com/photo-1511895426328-dc8714191300?w=800&auto=format&fit=crop&q=80', 'Gia đình']);
        $initAlbum->execute([$newUserId, 'Chuyến đi đáng nhớ', 'Lưu lại những chuyến hành trình khám phá thế giới rộng lớn.', 'https://images.unsplash.com/photo-1506744038136-46273834b3fb?w=800&auto=format&fit=crop&q=80', 'Du lịch']);

        logActivity($newUserId, 'REGISTER', 'Tạo tài khoản mới thành công');

        $stmt = $pdo->prepare("SELECT id, username, email, full_name, avatar_url, bio, role, status, storage_quota, used_storage, created_at FROM users WHERE id = ?");
        $stmt->execute([$newUserId]);
        $user = $stmt->fetch();

        jsonResponse([
            'message' => 'Đăng ký tài khoản thành công!',
            'user' => $user,
            'token' => (string)$user['id']
        ], 201);
        break;

    case 'me':
        $user = getCurrentUser();
        if (!$user) {
            jsonResponse(['authenticated' => false, 'user' => null]);
            break;
        }
        updateUserStorage($user['id']);
        jsonResponse(['authenticated' => true, 'user' => $user]);
        break;

    case 'logout':
        $user = getCurrentUser();
        if ($user) {
            logActivity($user['id'], 'LOGOUT', 'Đăng xuất khỏi tài khoản');
        }
        $_SESSION = [];
        if (ini_get("session.use_cookies")) {
            $params = session_get_cookie_params();
            setcookie(session_name(), '', time() - 42000,
                $params["path"], $params["domain"],
                $params["secure"], $params["httponly"]
            );
        }
        session_destroy();
        jsonResponse(['message' => 'Đã đăng xuất thành công.']);
        break;

    case 'update_profile':
        $user = requireAuth();
        $fullName = trim($input['full_name'] ?? $user['full_name']);
        $bio = trim($input['bio'] ?? $user['bio']);
        $avatarUrl = trim($input['avatar_url'] ?? $user['avatar_url']);

        // Handle uploaded avatar file if sent
        if (isset($_FILES['avatar_file']) && $_FILES['avatar_file']['error'] === UPLOAD_ERR_OK) {
            $file = $_FILES['avatar_file'];
            $ext = strtolower(pathinfo($file['name'], PATHINFO_EXTENSION));
            if (in_array($ext, ['jpg', 'jpeg', 'png', 'webp', 'gif'])) {
                $avatarFileName = 'avatar_' . $user['id'] . '_' . time() . '.' . $ext;
                $destDir = __DIR__ . '/../uploads/avatars/';
                if (!is_dir($destDir)) {
                    mkdir($destDir, 0777, true);
                }
                $destPath = $destDir . $avatarFileName;
                if (move_uploaded_file($file['tmp_name'], $destPath)) {
                    $avatarUrl = 'uploads/avatars/' . $avatarFileName;
                }
            }
        }

        $update = $pdo->prepare("UPDATE users SET full_name = ?, bio = ?, avatar_url = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?");
        $update->execute([$fullName, $bio, $avatarUrl, $user['id']]);

        logActivity($user['id'], 'PROFILE_UPDATE', 'Cập nhật thông tin hồ sơ cá nhân');

        $stmt = $pdo->prepare("SELECT id, username, email, full_name, avatar_url, bio, role, status, storage_quota, used_storage, created_at FROM users WHERE id = ?");
        $stmt->execute([$user['id']]);
        $updatedUser = $stmt->fetch();

        jsonResponse([
            'message' => 'Cập nhật hồ sơ thành công!',
            'user' => $updatedUser
        ]);
        break;

    case 'change_password':
        $user = requireAuth();
        $currentPassword = $input['current_password'] ?? '';
        $newPassword = $input['new_password'] ?? '';
        $confirmPassword = $input['confirm_password'] ?? '';

        if (empty($currentPassword) || empty($newPassword)) {
            jsonResponse(['error' => 'Vui lòng nhập mật khẩu hiện tại và mật khẩu mới.'], 422);
        }

        if (strlen($newPassword) < 6) {
            jsonResponse(['error' => 'Mật khẩu mới phải có ít nhất 6 ký tự.'], 422);
        }

        if ($newPassword !== $confirmPassword) {
            jsonResponse(['error' => 'Mật khẩu xác nhận không trùng khớp.'], 422);
        }

        $stmt = $pdo->prepare("SELECT password_hash FROM users WHERE id = ?");
        $stmt->execute([$user['id']]);
        $hash = $stmt->fetchColumn();

        if (!password_verify($currentPassword, $hash)) {
            jsonResponse(['error' => 'Mật khẩu hiện tại không chính xác.'], 422);
        }

        $newHash = password_hash($newPassword, PASSWORD_BCRYPT);
        $update = $pdo->prepare("UPDATE users SET password_hash = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?");
        $update->execute([$newHash, $user['id']]);

        logActivity($user['id'], 'PASSWORD_CHANGE', 'Đổi mật khẩu tài khoản');

        jsonResponse(['message' => 'Đổi mật khẩu thành công!']);
        break;

    case 'forgot_password':
        $email = strtolower(trim($input['email'] ?? ''));
        if (empty($email)) {
            jsonResponse(['error' => 'Vui lòng nhập email.'], 422);
        }
        $stmt = $pdo->prepare("SELECT id FROM users WHERE email = ?");
        $stmt->execute([$email]);
        if ($stmt->fetch()) {
            jsonResponse(['message' => 'Hệ thống đã ghi nhận yêu cầu khôi phục mật khẩu. Vui lòng kiểm tra hộp thư hoặc liên hệ quản trị viên (hoặc đăng nhập với tài khoản Demo@123).']);
        } else {
            jsonResponse(['error' => 'Không tìm thấy tài khoản với email này.'], 404);
        }
        break;

    default:
        jsonResponse(['error' => 'Action không tồn tại.'], 404);
}
