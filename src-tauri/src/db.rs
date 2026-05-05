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
            created_at TEXT DEFAULT (datetime('now','localtime'))
        )",
        (),
    )?;

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
            member_id INTEGER NOT NULL,
            service_id INTEGER,
            member_name TEXT NOT NULL,
            service_name TEXT NOT NULL,
            amount REAL NOT NULL,
            payment_method TEXT NOT NULL,
            note TEXT DEFAULT '',
            created_at TEXT DEFAULT (datetime('now','localtime')),
            FOREIGN KEY (member_id) REFERENCES members(id)
        )",
        (),
    )?;

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

    // 等级折扣表
    conn.execute(
        "CREATE TABLE IF NOT EXISTS levels (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL UNIQUE,
            discount REAL NOT NULL DEFAULT 1.0,
            threshold REAL NOT NULL DEFAULT 0
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

    // 插入默认等级折扣
    let lc: i32 = conn.query_row("SELECT COUNT(*) FROM levels", [], |r| r.get(0))?;
    if lc == 0 {
        conn.execute_batch(
            "INSERT INTO levels (name, discount, threshold) VALUES
             ('普通', 1.0, 0),
             ('银卡', 0.9, 500),
             ('金卡', 0.85, 1000),
             ('钻石', 0.75, 3000);"
        )?;
    }

    Ok(())
}
