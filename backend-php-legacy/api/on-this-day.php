<?php
/**
 * MEMORY GALLERY - On This Day API (Kỷ niệm hôm nay)
 * /api/on-this-day.php
 */

require_once __DIR__ . '/../config/helpers.php';

$pdo = Database::getConnection();
$user = requireAuth();
$userId = $user['id'];

// Default to today's month and day, but allow query parameter ?date=YYYY-MM-DD or MM-DD for testing
$reqDate = $_GET['date'] ?? date('Y-m-d');
$dateObj = new DateTime($reqDate);
$currentMonthDay = $dateObj->format('m-d');
$currentYear = (int)$dateObj->format('Y');

// Search for memories with the same month and day in previous years (memory_date or created_at)
$sql = "SELECT m.*, a.title as album_title 
        FROM memories m 
        LEFT JOIN albums a ON m.album_id = a.id 
        WHERE m.user_id = ? 
        AND (strftime('%m-%d', m.memory_date) = ? OR strftime('%m-%d', m.created_at) = ?)
        AND (strftime('%Y', m.memory_date) < ? OR strftime('%Y', m.created_at) < ?)
        ORDER BY m.memory_date DESC";

$stmt = $pdo->prepare($sql);
$stmt->execute([$userId, $currentMonthDay, $currentMonthDay, (string)$currentYear, (string)$currentYear]);
$memories = $stmt->fetchAll();

// Group memories by years ago
$grouped = [];
foreach ($memories as &$m) {
    $m['formatted_size'] = formatBytes($m['file_size']);
    $memYear = (int)(new DateTime($m['memory_date']))->format('Y');
    $yearsAgo = max(1, $currentYear - $memYear);

    $label = $yearsAgo == 1 ? '1 năm trước (' . $memYear . ')' : "$yearsAgo năm trước ($memYear)";
    
    if (!isset($grouped[$memYear])) {
        $grouped[$memYear] = [
            'year' => $memYear,
            'years_ago' => $yearsAgo,
            'label' => $label,
            'memories' => []
        ];
    }
    $grouped[$memYear]['memories'][] = $m;
}

// Sort by recent years
krsort($grouped);

jsonResponse([
    'target_date' => $reqDate,
    'formatted_date' => 'Ngày ' . $dateObj->format('d/m'),
    'has_memories' => !empty($memories),
    'total_memories' => count($memories),
    'groups' => array_values($grouped)
]);

