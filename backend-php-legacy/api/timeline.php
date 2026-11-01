<?php
/**
 * MEMORY GALLERY - Timeline API (Hành trình ký ức)
 * /api/timeline.php
 */

require_once __DIR__ . '/../config/helpers.php';

$pdo = Database::getConnection();
$user = requireAuth();
$userId = $user['id'];

$yearFilter = isset($_GET['year']) && !empty($_GET['year']) ? (int)$_GET['year'] : null;

// Get all distinct years for navigation
$yearQuery = $pdo->prepare("SELECT DISTINCT strftime('%Y', memory_date) as year 
                            FROM memories 
                            WHERE user_id = ? AND memory_date IS NOT NULL 
                            ORDER BY year DESC");
$yearQuery->execute([$userId]);
$years = array_filter(array_column($yearQuery->fetchAll(), 'year'));

// Query memories
$where = ["user_id = ?"];
$params = [$userId];

if ($yearFilter) {
    $where[] = "strftime('%Y', memory_date) = ?";
    $params[] = (string)$yearFilter;
}

$sql = "SELECT id, title, description, file_path, file_name, file_type, memory_date, location, is_favorite, duration 
        FROM memories 
        WHERE " . implode(" AND ", $where) . " 
        ORDER BY memory_date DESC, id DESC";

$stmt = $pdo->prepare($sql);
$stmt->execute($params);
$memories = $stmt->fetchAll();

// Group by Year -> Month
$grouped = [];
foreach ($memories as $m) {
    $dateObj = new DateTime($m['memory_date']);
    $y = $dateObj->format('Y');
    $mNum = $dateObj->format('m');
    $mName = 'Tháng ' . $mNum;

    if (!isset($grouped[$y])) {
        $grouped[$y] = [
            'year' => $y,
            'total' => 0,
            'months' => []
        ];
    }

    if (!isset($grouped[$y]['months'][$mNum])) {
        $grouped[$y]['months'][$mNum] = [
            'month' => $mNum,
            'month_name' => $mName,
            'total' => 0,
            'items' => []
        ];
    }

    $grouped[$y]['total']++;
    $grouped[$y]['months'][$mNum]['total']++;
    $grouped[$y]['months'][$mNum]['items'][] = $m;
}

// Convert associative months to indexed array
$result = [];
foreach ($grouped as $y => $yData) {
    $yData['months'] = array_values($yData['months']);
    $result[] = $yData;
}

jsonResponse([
    'available_years' => array_values($years),
    'selected_year' => $yearFilter,
    'total_memories' => count($memories),
    'timeline' => $result
]);

