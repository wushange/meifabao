use rusqlite::Connection;
use std::path::Path;

pub fn init_db(db_path: &Path) -> rusqlite::Result<()> {
    let conn = Connection::open(db_path)?;

    conn.execute_batch("PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON;")?;

    // 会员表
    conn.execute(
        "CREATE TABLE IF NOT EXISTS members (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            phone TEXT UNIQUE NOT NULL,
            level TEXT DEFAULT '普通',
            balance REAL DEFAULT 0.0,
            total_spent REAL DEFAULT 0.0,
            created_at TEXT DEFAULT (datetime('now','localtime')),
            note TEXT DEFAULT ''
        )",
        (),
    )?;

    // 兼容旧库：加 note 列
    let _ = conn.execute("ALTER TABLE members ADD COLUMN note TEXT DEFAULT ''", ());

    // 服务表
    conn.execute(
        "CREATE TABLE IF NOT EXISTS services (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            price REAL NOT NULL,
            category TEXT DEFAULT '基础'
        )",
        (),
    )?;

    // 消费记录表
    conn.execute(
        "CREATE TABLE IF NOT EXISTS records (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            order_id INTEGER NOT NULL DEFAULT 0,
            member_id INTEGER NOT NULL,
            service_id INTEGER,
            member_name TEXT NOT NULL,
            service_name TEXT NOT NULL,
            amount REAL NOT NULL,
            original_price REAL NOT NULL DEFAULT 0,
            discount_rate REAL NOT NULL DEFAULT 1.0,
            payment_method TEXT NOT NULL,
            note TEXT DEFAULT '',
            created_at TEXT DEFAULT (datetime('now','localtime')),
            FOREIGN KEY (member_id) REFERENCES members(id)
        )",
        (),
    )?;

    // 兼容旧库：加列
    let _ = conn.execute("ALTER TABLE records ADD COLUMN order_id INTEGER NOT NULL DEFAULT 0", ());
    let _ = conn.execute("ALTER TABLE records ADD COLUMN original_price REAL NOT NULL DEFAULT 0", ());
    let _ = conn.execute("ALTER TABLE records ADD COLUMN discount_rate REAL NOT NULL DEFAULT 1.0", ());

    // 充值记录表
    conn.execute(
        "CREATE TABLE IF NOT EXISTS recharges (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            member_id INTEGER NOT NULL,
            amount REAL NOT NULL,
            note TEXT DEFAULT '',
            created_at TEXT DEFAULT (datetime('now','localtime')),
            FOREIGN KEY (member_id) REFERENCES members(id)
        )",
        (),
    )?;

    // 插入默认服务
    let sc: i32 = conn.query_row("SELECT COUNT(*) FROM services", [], |r| r.get(0))?;
    if sc == 0 {
        conn.execute_batch(
            "INSERT INTO services (name, price, category) VALUES
             ('洗剪吹', 35, '剪发'),
             ('单剪', 25, '剪发'),
             ('洗头', 15, '洗护'),
             ('染发', 128, '烫染'),
             ('烫发', 168, '烫染'),
             ('护理', 88, '洗护'),
             ('造型', 50, '造型');"
        )?;
    }

    // 索引
    let _ = conn.execute("CREATE INDEX IF NOT EXISTS idx_records_member_id ON records(member_id)", ());
    let _ = conn.execute("CREATE INDEX IF NOT EXISTS idx_records_created_at ON records(created_at)", ());
    let _ = conn.execute("CREATE INDEX IF NOT EXISTS idx_recharges_member_id ON recharges(member_id)", ());

    // 设置表（key-value 存储）
    conn.execute(
        "CREATE TABLE IF NOT EXISTS settings (
            key TEXT PRIMARY KEY,
            value TEXT NOT NULL
        )",
        (),
    )?;

    // 插入默认备份配置
    conn.execute_batch(
        "INSERT OR IGNORE INTO settings (key, value) VALUES
         ('backup_dir', ''),
         ('backup_keep_days', '30'),
         ('backup_hour', '2');"
    )?;

    Ok(())
}
