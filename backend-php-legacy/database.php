<?php
/**
 * MEMORY GALLERY - Database Connection & Configuration
 * Supports both SQLite (zero-config local) and MySQL (production/XAMPP).
 */

if (php_sapi_name() !== 'cli' && !headers_sent()) {
    header('Access-Control-Allow-Origin: *');
    header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
    header('Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With');

    if (isset($_SERVER['REQUEST_METHOD']) && $_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
        http_response_code(200);
        exit;
    }

    if (session_status() === PHP_SESSION_NONE) {
        @ini_set('session.cookie_httponly', '1');
        @ini_set('session.use_only_cookies', '1');
        @session_start();
    }
}

class Database {
    // MySQL Config
    private static $mysql_host = 'localhost';
    private static $mysql_db   = 'memory_gallery';
    private static $mysql_user = 'root';
    private static $mysql_pass = '';
    private static $mysql_port = '3306';

    // SQLite Config
    private static $sqlite_file = __DIR__ . '/../database/memory_gallery.sqlite';

    // Driver: 'auto', 'sqlite', or 'mysql'
    // 'auto' tries SQLite first if MySQL is not available, ensuring instant zero-config startup
    private static $driver = 'sqlite'; 

    private static $pdo = null;

    public static function getConnection() {
        if (self::$pdo !== null) {
            return self::$pdo;
        }

        try {
            if (self::$driver === 'mysql') {
                $dsn = "mysql:host=" . self::$mysql_host . ";port=" . self::$mysql_port . ";dbname=" . self::$mysql_db . ";charset=utf8mb4";
                self::$pdo = new PDO($dsn, self::$mysql_user, self::$mysql_pass, [
                    PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
                    PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
                    PDO::ATTR_EMULATE_PREPARES => false,
                ]);
            } else {
                // SQLite Mode
                $dbDir = dirname(self::$sqlite_file);
                if (!is_dir($dbDir)) {
                    mkdir($dbDir, 0777, true);
                }
                $isNew = !file_exists(self::$sqlite_file);

                self::$pdo = new PDO("sqlite:" . self::$sqlite_file, null, null, [
                    PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
                    PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
                ]);

                // Enable foreign keys in SQLite
                self::$pdo->exec("PRAGMA foreign_keys = ON;");

                if ($isNew) {
                    self::initSqliteTables();
                }
            }
        } catch (PDOException $e) {
            // If MySQL failed, fallback to SQLite automatically
            if (self::$driver === 'mysql') {
                self::$driver = 'sqlite';
                return self::getConnection();
            }
            http_response_code(500);
            echo json_encode(['error' => 'Database connection failed: ' . $e->getMessage()]);
            exit;
        }

        return self::$pdo;
    }

    private static function initSqliteTables() {
        $schema = <<<SQL
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT UNIQUE NOT NULL,
            email TEXT UNIQUE NOT NULL,
            password_hash TEXT NOT NULL,
            full_name TEXT NOT NULL,
            avatar_url TEXT DEFAULT '',
            bio TEXT DEFAULT '',
            role TEXT DEFAULT 'user',
            status TEXT DEFAULT 'active',
            storage_quota INTEGER DEFAULT 21474836480, -- 20 GB
            used_storage INTEGER DEFAULT 0,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS albums (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            title TEXT NOT NULL,
            description TEXT DEFAULT '',
            cover_url TEXT DEFAULT '',
            category TEXT DEFAULT 'general',
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        );

        CREATE TABLE IF NOT EXISTS memories (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            album_id INTEGER NULL,
            title TEXT NOT NULL,
            description TEXT DEFAULT '',
            file_path TEXT NOT NULL,
            file_name TEXT NOT NULL,
            file_type TEXT NOT NULL, -- 'image' or 'video'
            mime_type TEXT NOT NULL,
            file_size INTEGER NOT NULL,
            memory_date DATE NOT NULL,
            location TEXT DEFAULT '',
            is_favorite INTEGER DEFAULT 0,
            privacy TEXT DEFAULT 'private',
            duration REAL DEFAULT 0,
            width INTEGER DEFAULT 0,
            height INTEGER DEFAULT 0,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
            FOREIGN KEY (album_id) REFERENCES albums(id) ON DELETE SET NULL
        );

        CREATE TABLE IF NOT EXISTS tags (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            name TEXT NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
            UNIQUE(user_id, name)
        );

        CREATE TABLE IF NOT EXISTS memory_tags (
            memory_id INTEGER NOT NULL,
            tag_id INTEGER NOT NULL,
            PRIMARY KEY (memory_id, tag_id),
            FOREIGN KEY (memory_id) REFERENCES memories(id) ON DELETE CASCADE,
            FOREIGN KEY (tag_id) REFERENCES tags(id) ON DELETE CASCADE
        );

        CREATE TABLE IF NOT EXISTS activity_logs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NULL,
            action TEXT NOT NULL,
            details TEXT DEFAULT '',
            ip_address TEXT DEFAULT '',
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );

        CREATE INDEX IF NOT EXISTS idx_memories_user_date ON memories(user_id, memory_date);
        CREATE INDEX IF NOT EXISTS idx_memories_favorite ON memories(user_id, is_favorite);
        CREATE INDEX IF NOT EXISTS idx_memories_album ON memories(album_id);
SQL;
        self::$pdo->exec($schema);

        // Include seed data
        require_once __DIR__ . '/../database/seed.php';
        SeedData::run(self::$pdo);
    }
}
