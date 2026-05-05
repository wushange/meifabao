use rusqlite::Connection;
use serde::{Deserialize, Serialize};
use std::path::PathBuf;

// ── 数据结构 ──

#[derive(Serialize, Deserialize, Clone)]
pub struct Member {
    pub id: Option<i32>,
    pub name: String,
    pub phone: String,
    pub level: Option<String>,
    pub balance: Option<f64>,
    pub note: Option<String>,
}

#[derive(Serialize)]
pub struct MemberFull {
    pub id: i32,
    pub name: String,
    pub phone: String,
    pub level: String,
    pub balance: f64,
    pub total_spent: f64,
    pub created_at: String,
    pub last_visit: Option<String>,
}

#[derive(Serialize)]
pub struct Service {
    pub id: i32,
    pub name: String,
    pub price: f64,
    pub category: String,
}

#[derive(Serialize)]
pub struct Record {
    pub id: i32,
    pub member_id: i32,
    pub member_name: String,
    pub service_id: i32,
    pub service_name: String,
    pub amount: f64,
    pub payment_method: String,
    pub note: String,
    pub created_at: String,
}

#[derive(Serialize)]
pub struct Recharge {
    pub id: i32,
    pub member_id: i32,
    pub amount: f64,
    pub note: String,
    pub created_at: String,
}

#[derive(Serialize)]
pub struct LevelInfo {
    pub name: String,
    pub discount: f64,
    pub threshold: f64,
}

#[derive(Deserialize)]
pub struct ImportMember {
    pub name: String,
    pub phone: String,
    pub level: Option<String>,
    pub balance: Option<f64>,
    pub note: Option<String>,
    pub total_spent: Option<f64>,
}

#[derive(Serialize)]
pub struct CheckoutReceipt {
    pub member_name: String,
    pub services: Vec<String>,
    pub original: f64,
    pub discount: f64,
    pub total: f64,
    pub payment_method: String,
    pub old_balance: f64,
    pub new_balance: f64,
}

// ── 辅助函数 ──

fn conn(db_path: &PathBuf) -> Result<Connection, String> {
    Connection::open(db_path.to_str().unwrap()).map_err(|e| e.to_string())
}

// ── 会员命令 ──

#[tauri::command]
pub fn get_members(db_path: tauri::State<PathBuf>) -> Result<Vec<MemberFull>, String> {
    let c = conn(db_path.inner())?;
    let mut stmt = c.prepare(
        "SELECT m.id, m.name, m.phone, m.level, m.balance, m.total_spent, m.created_at, COALESCE(m.note,''),
                (SELECT MAX(created_at) FROM records WHERE member_id=m.id) as last_visit
         FROM members m ORDER BY m.id DESC"
    ).map_err(|e| e.to_string())?;

    let rows = stmt.query_map([], |row| {
        Ok(MemberFull {
            id: row.get(0)?, name: row.get(1)?, phone: row.get(2)?,
            level: row.get(3)?, balance: row.get(4)?, total_spent: row.get(5)?,
            created_at: row.get(6)?, last_visit: row.get(7)?,
        })
    }).map_err(|e| e.to_string())?;

    rows.collect::<Result<Vec<_>, _>>().map_err(|e| e.to_string())
}

#[tauri::command]
pub fn search_members(db_path: tauri::State<PathBuf>, keyword: String) -> Result<Vec<MemberFull>, String> {
    let c = conn(db_path.inner())?;
    let pattern = format!("%{}%", keyword);
    let mut stmt = c.prepare(
        "SELECT m.id, m.name, m.phone, m.level, m.balance, m.total_spent, m.created_at, COALESCE(m.note,''),
                (SELECT MAX(created_at) FROM records WHERE member_id=m.id) as last_visit
         FROM members m WHERE m.phone LIKE ?1 OR m.name LIKE ?1
         ORDER BY m.id DESC LIMIT 20"
    ).map_err(|e| e.to_string())?;
    let rows = stmt.query_map([&pattern], |row| {
        Ok(MemberFull {
            id: row.get(0)?, name: row.get(1)?, phone: row.get(2)?,
            level: row.get(3)?, balance: row.get(4)?, total_spent: row.get(5)?,
            created_at: row.get(6)?, last_visit: row.get(7)?,
        })
    }).map_err(|e| e.to_string())?;
    rows.collect::<Result<Vec<_>, _>>().map_err(|e| e.to_string())
}

#[tauri::command]
pub fn add_member(db_path: tauri::State<PathBuf>, member: Member) -> Result<i32, String> {
    let c = conn(db_path.inner())?;
    c.execute(
        "INSERT INTO members (name, phone, level, balance, note) VALUES (?1,?2,?3,?4,?5)",
        rusqlite::params![member.name, member.phone, member.level.unwrap_or("普通".into()), member.balance.unwrap_or(0.0),
            member.note.unwrap_or("".into())],
    ).map_err(|e| e.to_string())?;
    Ok(c.last_insert_rowid() as i32)
}

#[tauri::command]
pub fn update_member(db_path: tauri::State<PathBuf>, member: Member) -> Result<(), String> {
    let c = conn(db_path.inner())?;
    c.execute(
        "UPDATE members SET name=?1, phone=?2, level=?3, balance=?4, note=?5 WHERE id=?6",
        rusqlite::params![member.name, member.phone, member.level, member.balance, member.note.unwrap_or("".into()), member.id],
    ).map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn delete_member(db_path: tauri::State<PathBuf>, id: i32) -> Result<(), String> {
    let c = conn(db_path.inner())?;
    c.execute("DELETE FROM records WHERE member_id=?1", rusqlite::params![id]).map_err(|e| e.to_string())?;
    c.execute("DELETE FROM recharges WHERE member_id=?1", rusqlite::params![id]).map_err(|e| e.to_string())?;
    c.execute("DELETE FROM members WHERE id=?1", rusqlite::params![id]).map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn batch_import_members(db_path: tauri::State<PathBuf>, members: Vec<ImportMember>) -> Result<(usize, usize), String> {
    let c = conn(db_path.inner())?;
    let mut ok = 0;
    let mut skip = 0;
    for m in members {
        let exists: bool = c.query_row("SELECT 1 FROM members WHERE phone=?1", rusqlite::params![m.phone], |_| Ok(true)).unwrap_or(false);
        if exists { skip += 1; continue; }
        match c.execute(
            "INSERT INTO members (name, phone, level, balance, note, total_spent) VALUES (?1,?2,?3,?4,?5,?6)",
            rusqlite::params![m.name, m.phone, m.level.unwrap_or("普通".into()), m.balance.unwrap_or(0.0), m.note.unwrap_or("".into()), m.total_spent.unwrap_or(0.0)],
        ) { Ok(_) => ok += 1, Err(_) => skip += 1 }
    }
    Ok((ok, skip))
}

// ── 服务命令 ──

#[tauri::command]
pub fn get_services(db_path: tauri::State<PathBuf>) -> Result<Vec<Service>, String> {
    let c = conn(db_path.inner())?;
    let mut stmt = c.prepare("SELECT id, name, price, category FROM services ORDER BY category, id")
        .map_err(|e| e.to_string())?;
    let rows = stmt.query_map([], |row| {
        Ok(Service { id: row.get(0)?, name: row.get(1)?, price: row.get(2)?, category: row.get(3)? })
    }).map_err(|e| e.to_string())?;
    rows.collect::<Result<Vec<_>, _>>().map_err(|e| e.to_string())
}

#[tauri::command]
pub fn add_service(db_path: tauri::State<PathBuf>, name: String, price: f64, category: String) -> Result<i32, String> {
    let c = conn(db_path.inner())?;
    c.execute("INSERT INTO services (name,price,category) VALUES (?1,?2,?3)", rusqlite::params![name, price, category])
        .map_err(|e| e.to_string())?;
    Ok(c.last_insert_rowid() as i32)
}

#[tauri::command]
pub fn update_service(db_path: tauri::State<PathBuf>, id: i32, name: String, price: f64, category: String) -> Result<(), String> {
    let c = conn(db_path.inner())?;
    c.execute("UPDATE services SET name=?1,price=?2,category=?3 WHERE id=?4", rusqlite::params![name, price, category, id])
        .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn delete_service(db_path: tauri::State<PathBuf>, id: i32) -> Result<(), String> {
    let c = conn(db_path.inner())?;
    c.execute("DELETE FROM services WHERE id=?1", rusqlite::params![id]).map_err(|e| e.to_string())?;
    Ok(())
}

// ── 等级折扣命令 ──

#[tauri::command]
pub fn get_levels(db_path: tauri::State<PathBuf>) -> Result<Vec<LevelInfo>, String> {
    let c = conn(db_path.inner())?;
    let mut stmt = c.prepare("SELECT name, discount, threshold FROM levels ORDER BY discount DESC")
        .map_err(|e| e.to_string())?;
    let rows = stmt.query_map([], |row| {
        Ok(LevelInfo { name: row.get(0)?, discount: row.get(1)?, threshold: row.get(2)? })
    }).map_err(|e| e.to_string())?;
    rows.collect::<Result<Vec<_>, _>>().map_err(|e| e.to_string())
}

#[tauri::command]
pub fn update_level(db_path: tauri::State<PathBuf>, name: String, discount: f64, threshold: f64) -> Result<(), String> {
    let c = conn(db_path.inner())?;
    c.execute("UPDATE levels SET discount=?1, threshold=?2 WHERE name=?3", rusqlite::params![discount, threshold, name])
        .map_err(|e| e.to_string())?;
    Ok(())
}

// ── 消费记录命令 ──

#[tauri::command]
pub fn get_records(db_path: tauri::State<PathBuf>, member_id: Option<i32>, limit: Option<i32>) -> Result<Vec<Record>, String> {
    let c = conn(db_path.inner())?;
    let lim = limit.unwrap_or(200);
    let records = if let Some(mid) = member_id {
        let mut stmt = c.prepare(
            "SELECT r.id, r.member_id, r.member_name, COALESCE(r.service_id,0), r.service_name, r.amount, r.payment_method, COALESCE(r.note,''), r.created_at
             FROM records r WHERE r.member_id=?1 ORDER BY r.created_at DESC LIMIT ?2"
        ).map_err(|e| e.to_string())?;
        let rows = stmt.query_map(rusqlite::params![mid, lim], |row| {
            Ok(Record {
                id: row.get(0)?, member_id: row.get(1)?, member_name: row.get(2)?,
                service_id: row.get(3)?, service_name: row.get(4)?, amount: row.get(5)?,
                payment_method: row.get(6)?, note: row.get(7)?, created_at: row.get(8)?,
            })
        }).map_err(|e| e.to_string())?;
        rows.collect::<Result<Vec<_>, _>>().map_err(|e| e.to_string())?
    } else {
        let mut stmt = c.prepare(
            "SELECT r.id, r.member_id, r.member_name, COALESCE(r.service_id,0), r.service_name, r.amount, r.payment_method, COALESCE(r.note,''), r.created_at
             FROM records r ORDER BY r.created_at DESC LIMIT ?1"
        ).map_err(|e| e.to_string())?;
        let rows = stmt.query_map([lim], |row| {
            Ok(Record {
                id: row.get(0)?, member_id: row.get(1)?, member_name: row.get(2)?,
                service_id: row.get(3)?, service_name: row.get(4)?, amount: row.get(5)?,
                payment_method: row.get(6)?, note: row.get(7)?, created_at: row.get(8)?,
            })
        }).map_err(|e| e.to_string())?;
        rows.collect::<Result<Vec<_>, _>>().map_err(|e| e.to_string())?
    };
    Ok(records)
}

#[tauri::command]
pub fn delete_record(db_path: tauri::State<PathBuf>, id: i32) -> Result<(), String> {
    let c = conn(db_path.inner())?;
    c.execute("DELETE FROM records WHERE id=?1", rusqlite::params![id]).map_err(|e| e.to_string())?;
    Ok(())
}

// ── 收银结账命令（支持多服务 + 折扣 + 余额扣减）──

#[tauri::command]
pub fn checkout(
    db_path: tauri::State<PathBuf>,
    member_id: i32,
    service_ids: Vec<i32>,
    payment_method: String,
    note: String,
) -> Result<CheckoutReceipt, String> {
    let c = conn(db_path.inner())?;

    // 获取会员信息
    let (member_name, level, old_balance): (String, String, f64) = c.query_row(
        "SELECT name, level, balance FROM members WHERE id=?1",
        rusqlite::params![member_id],
        |row| Ok((row.get(0)?, row.get(1)?, row.get(2)?)),
    ).map_err(|e| e.to_string())?;

    // 获取折扣率
    let discount_rate: f64 = c.query_row(
        "SELECT discount FROM levels WHERE name=?1",
        rusqlite::params![&level],
        |row| row.get(0),
    ).unwrap_or(1.0);

    // 计算总价
    let mut service_names: Vec<String> = Vec::new();
    let mut original = 0.0;
    let mut total = 0.0;

    for sid in &service_ids {
        let (sname, sprice): (String, f64) = c.query_row(
            "SELECT name, price FROM services WHERE id=?1",
            rusqlite::params![sid],
            |row| Ok((row.get(0)?, row.get(1)?)),
        ).map_err(|e| format!("服务ID {} 不存在: {}", sid, e))?;

        service_names.push(sname.clone());
        original += sprice;
        let discounted = (sprice * discount_rate * 100.0).round() / 100.0;
        total += discounted;

        // 写入消费记录
        c.execute(
            "INSERT INTO records (member_id, service_id, member_name, service_name, amount, payment_method, note)
             VALUES (?1,?2,?3,?4,?5,?6,?7)",
            rusqlite::params![member_id, sid, member_name, sname, discounted, payment_method, note],
        ).map_err(|e| e.to_string())?;
    }

    let discount = original - total;
    let mut new_balance = old_balance;

    // 余额支付：扣减余额 + 累加消费总额
    if payment_method.contains("余额") || payment_method == "balance" {
        if old_balance < total {
            return Err(format!("余额不足！当前余额 ¥{:.2}，需要 ¥{:.2}", old_balance, total));
        }
        new_balance = old_balance - total;
    }

    // 更新会员余额和消费总额
    c.execute(
        "UPDATE members SET balance=?1, total_spent=total_spent+?2 WHERE id=?3",
        rusqlite::params![new_balance, total, member_id],
    ).map_err(|e| e.to_string())?;

    // 自动升级会员等级
    let new_total_spent: f64 = c.query_row(
        "SELECT total_spent FROM members WHERE id=?1",
        rusqlite::params![member_id],
        |row| row.get(0),
    ).map_err(|e| e.to_string())?;

    let best_level: Option<String> = c.query_row(
        "SELECT name FROM levels WHERE threshold <= ?1 ORDER BY threshold DESC LIMIT 1",
        rusqlite::params![new_total_spent],
        |row| row.get(0),
    ).ok();

    if let Some(ref lv) = best_level {
        let current_levels: Vec<String> = ["钻石", "金卡", "银卡", "普通"].iter().map(|s| s.to_string()).collect();
        let level_rank = |l: &str| current_levels.iter().position(|x| x == l).unwrap_or(99);
        if level_rank(lv) < level_rank(&level) {
            c.execute("UPDATE members SET level=?1 WHERE id=?2", rusqlite::params![lv, member_id])
                .map_err(|e| e.to_string())?;
        }
    }

    Ok(CheckoutReceipt {
        member_name,
        services: service_names,
        original: (original * 100.0).round() / 100.0,
        discount: (discount * 100.0).round() / 100.0,
        total: (total * 100.0).round() / 100.0,
        payment_method,
        old_balance: (old_balance * 100.0).round() / 100.0,
        new_balance: (new_balance * 100.0).round() / 100.0,
    })
}

// ── 充值命令 ──

#[tauri::command]
pub fn recharge(db_path: tauri::State<PathBuf>, member_id: i32, amount: f64, note: String) -> Result<f64, String> {
    let c = conn(db_path.inner())?;
    c.execute("INSERT INTO recharges (member_id, amount, note) VALUES (?1,?2,?3)",
        rusqlite::params![member_id, amount, note]).map_err(|e| e.to_string())?;
    c.execute("UPDATE members SET balance=balance+?1 WHERE id=?2",
        rusqlite::params![amount, member_id]).map_err(|e| e.to_string())?;
    let new_balance: f64 = c.query_row("SELECT balance FROM members WHERE id=?1",
        rusqlite::params![member_id], |row| row.get(0)).map_err(|e| e.to_string())?;
    Ok(new_balance)
}

#[tauri::command]
pub fn get_recharges(db_path: tauri::State<PathBuf>, member_id: Option<i32>) -> Result<Vec<Recharge>, String> {
    let c = conn(db_path.inner())?;
    let recharges = if let Some(mid) = member_id {
        let mut stmt = c.prepare(
            "SELECT id, member_id, amount, COALESCE(note,''), created_at FROM recharges WHERE member_id=?1 ORDER BY created_at DESC LIMIT 100"
        ).map_err(|e| e.to_string())?;
        let rows = stmt.query_map(rusqlite::params![mid], |row| {
            Ok(Recharge { id: row.get(0)?, member_id: row.get(1)?, amount: row.get(2)?, note: row.get(3)?, created_at: row.get(4)? })
        }).map_err(|e| e.to_string())?;
        rows.collect::<Result<Vec<_>, _>>().map_err(|e| e.to_string())?
    } else {
        let mut stmt = c.prepare(
            "SELECT id, member_id, amount, COALESCE(note,''), created_at FROM recharges ORDER BY created_at DESC LIMIT 100"
        ).map_err(|e| e.to_string())?;
        let rows = stmt.query_map([], |row| {
            Ok(Recharge { id: row.get(0)?, member_id: row.get(1)?, amount: row.get(2)?, note: row.get(3)?, created_at: row.get(4)? })
        }).map_err(|e| e.to_string())?;
        rows.collect::<Result<Vec<_>, _>>().map_err(|e| e.to_string())?
    };
    Ok(recharges)
}

// ── 数据管理命令 ──

#[tauri::command]
pub fn export_all_data(db_path: tauri::State<PathBuf>) -> Result<String, String> {
    let c = conn(db_path.inner())?;
    let members: Vec<MemberFull> = get_members_impl(&c)?;
    let services: Vec<Service> = get_services_impl(&c)?;
    let records: Vec<Record> = get_records_impl(&c, None, Some(10000))?;
    let recharges: Vec<Recharge> = get_recharges_impl(&c, None)?;
    let data = serde_json::json!({
        "exportTime": chrono_now(),
        "members": members,
        "services": services,
        "records": records,
        "recharges": recharges,
    });
    serde_json::to_string_pretty(&data).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn clear_all_data(db_path: tauri::State<PathBuf>) -> Result<(), String> {
    let c = conn(db_path.inner())?;
    c.execute_batch("DELETE FROM records; DELETE FROM recharges; DELETE FROM members;")
        .map_err(|e| e.to_string())?;
    Ok(())
}

// ── 内部辅助（不用#[tauri::command]，供 export 复用）──

fn chrono_now() -> String {
    // 简单时间戳，不引入 chrono 依赖
    "".to_string() // 前端会填
}

fn get_members_impl(c: &Connection) -> Result<Vec<MemberFull>, String> {
    let mut stmt = c.prepare(
        "SELECT id,name,phone,level,balance,total_spent,created_at,COALESCE(note,'') FROM members ORDER BY id"
    ).map_err(|e| e.to_string())?;
    let rows = stmt.query_map([], |row| {
        Ok(MemberFull {
            id: row.get(0)?, name: row.get(1)?, phone: row.get(2)?,
            level: row.get(3)?, balance: row.get(4)?, total_spent: row.get(5)?,
            created_at: row.get(6)?, last_visit: None,
        })
    }).map_err(|e| e.to_string())?;
    rows.collect::<Result<Vec<_>, _>>().map_err(|e| e.to_string())
}

fn get_services_impl(c: &Connection) -> Result<Vec<Service>, String> {
    let mut stmt = c.prepare("SELECT id,name,price,category FROM services ORDER BY id")
        .map_err(|e| e.to_string())?;
    let rows = stmt.query_map([], |row| {
        Ok(Service { id: row.get(0)?, name: row.get(1)?, price: row.get(2)?, category: row.get(3)? })
    }).map_err(|e| e.to_string())?;
    rows.collect::<Result<Vec<_>, _>>().map_err(|e| e.to_string())
}

fn get_records_impl(c: &Connection, member_id: Option<i32>, limit: Option<i32>) -> Result<Vec<Record>, String> {
    let lim = limit.unwrap_or(200);
    if let Some(mid) = member_id {
        let mut stmt = c.prepare(
            "SELECT id,member_id,member_name,COALESCE(service_id,0),service_name,amount,payment_method,COALESCE(note,''),created_at
             FROM records WHERE member_id=?1 ORDER BY created_at DESC LIMIT ?2"
        ).map_err(|e| e.to_string())?;
        let rows = stmt.query_map(rusqlite::params![mid, lim], |row| {
            Ok(Record { id: row.get(0)?, member_id: row.get(1)?, member_name: row.get(2)?,
                service_id: row.get(3)?, service_name: row.get(4)?, amount: row.get(5)?,
                payment_method: row.get(6)?, note: row.get(7)?, created_at: row.get(8)? })
        }).map_err(|e| e.to_string())?;
        rows.collect::<Result<Vec<_>, _>>().map_err(|e| e.to_string())
    } else {
        let mut stmt = c.prepare(
            "SELECT id,member_id,member_name,COALESCE(service_id,0),service_name,amount,payment_method,COALESCE(note,''),created_at
             FROM records ORDER BY created_at DESC LIMIT ?1"
        ).map_err(|e| e.to_string())?;
        let rows = stmt.query_map([lim], |row| {
            Ok(Record { id: row.get(0)?, member_id: row.get(1)?, member_name: row.get(2)?,
                service_id: row.get(3)?, service_name: row.get(4)?, amount: row.get(5)?,
                payment_method: row.get(6)?, note: row.get(7)?, created_at: row.get(8)? })
        }).map_err(|e| e.to_string())?;
        rows.collect::<Result<Vec<_>, _>>().map_err(|e| e.to_string())
    }
}

fn get_recharges_impl(c: &Connection, member_id: Option<i32>) -> Result<Vec<Recharge>, String> {
    if let Some(mid) = member_id {
        let mut stmt = c.prepare(
            "SELECT id,member_id,amount,COALESCE(note,''),created_at FROM recharges WHERE member_id=?1 ORDER BY created_at DESC LIMIT 100"
        ).map_err(|e| e.to_string())?;
        let rows = stmt.query_map(rusqlite::params![mid], |row| {
            Ok(Recharge { id: row.get(0)?, member_id: row.get(1)?, amount: row.get(2)?, note: row.get(3)?, created_at: row.get(4)? })
        }).map_err(|e| e.to_string())?;
        rows.collect::<Result<Vec<_>, _>>().map_err(|e| e.to_string())
    } else {
        let mut stmt = c.prepare(
            "SELECT id,member_id,amount,COALESCE(note,''),created_at FROM recharges ORDER BY created_at DESC LIMIT 100"
        ).map_err(|e| e.to_string())?;
        let rows = stmt.query_map([], |row| {
            Ok(Recharge { id: row.get(0)?, member_id: row.get(1)?, amount: row.get(2)?, note: row.get(3)?, created_at: row.get(4)? })
        }).map_err(|e| e.to_string())?;
        rows.collect::<Result<Vec<_>, _>>().map_err(|e| e.to_string())
    }
}

// ── 每日自动备份 ──

#[derive(Serialize)]
pub struct BackupResult {
    pub backed_up: bool,
    pub path: String,
    pub message: String,
}

#[tauri::command]
pub fn daily_backup(db_path: tauri::State<PathBuf>, app_handle: tauri::AppHandle) -> Result<BackupResult, String> {
    use std::fs;
    use std::io::Write;
    use tauri::Manager;

    let c = conn(db_path.inner())?;

    let data_dir = app_handle.path().app_data_dir().map_err(|e| e.to_string())?;
    let backup_dir = data_dir.join("backups");
    fs::create_dir_all(&backup_dir).map_err(|e| e.to_string())?;

    let today = chrono_now_str();
    let filename = format!("members_{}.csv", today);
    let filepath = backup_dir.join(&filename);

    if filepath.exists() {
        return Ok(BackupResult {
            backed_up: false,
            path: filepath.to_string_lossy().to_string(),
            message: "今日已备份".to_string(),
        });
    }

    let mut stmt = c.prepare(
        "SELECT name, phone, level, balance, total_spent, created_at, COALESCE(note,'') FROM members ORDER BY id"
    ).map_err(|e| e.to_string())?;

    let rows = stmt.query_map([], |row| {
        Ok((
            row.get::<_, String>(0)?,
            row.get::<_, String>(1)?,
            row.get::<_, String>(2)?,
            row.get::<_, f64>(3)?,
            row.get::<_, f64>(4)?,
            row.get::<_, String>(5)?,
            row.get::<_, String>(6)?,
        ))
    }).map_err(|e| e.to_string())?;

    let mut file = fs::File::create(&filepath).map_err(|e| e.to_string())?;
    file.write_all(b"\xEF\xBB\xBF").map_err(|e| e.to_string())?;
    writeln!(file, "姓名,手机号,等级,余额,累计消费,注册时间,备注").map_err(|e| e.to_string())?;

    let mut count = 0;
    for row in rows {
        let (name, phone, level, balance, total_spent, created_at, mem_note) = row.map_err(|e| e.to_string())?;
        writeln!(file, "{},{},{},{:.2},{:.2},{},{}",
            csv_escape(&name), csv_escape(&phone), csv_escape(&level),
            balance, total_spent, csv_escape(&created_at),
            csv_escape(&mem_note),
        ).map_err(|e| e.to_string())?;
        count += 1;
    }

    // 保留最近 30 天
    if let Ok(entries) = fs::read_dir(&backup_dir) {
        let mut files: Vec<_> = entries
            .filter_map(|e| e.ok())
            .filter(|e| e.file_name().to_string_lossy().ends_with(".csv"))
            .collect();
        files.sort_by_key(|e| e.metadata().and_then(|m| m.modified()).unwrap_or(std::time::SystemTime::UNIX_EPOCH));
        if files.len() > 30 {
            for old in files.iter().take(files.len() - 30) {
                let _ = fs::remove_file(old.path());
            }
        }
    }

    Ok(BackupResult {
        backed_up: true,
        path: filepath.to_string_lossy().to_string(),
        message: format!("已备份 {} 名会员", count),
    })
}

fn chrono_now_str() -> String {
    use std::time::SystemTime;
    let dur = SystemTime::now().duration_since(SystemTime::UNIX_EPOCH).unwrap_or_default();
    let total_days = (dur.as_secs() / 86400) as i32;
    let mut year = 1970i32;
    let mut remaining = total_days;
    loop {
        let diy = if is_leap(year) { 366 } else { 365 };
        if remaining < diy { break; }
        remaining -= diy;
        year += 1;
    }
    let mdays = if is_leap(year) {
        [31,29,31,30,31,30,31,31,30,31,30,31]
    } else {
        [31,28,31,30,31,30,31,31,30,31,30,31]
    };
    let mut month = 1;
    for &md in mdays.iter() {
        if remaining < md { break; }
        remaining -= md;
        month += 1;
    }
    format!("{:04}-{:02}-{:02}", year, month, remaining + 1)
}

fn is_leap(y: i32) -> bool { (y % 4 == 0 && y % 100 != 0) || (y % 400 == 0) }

fn csv_escape(s: &str) -> String {
    if s.contains(',') || s.contains('"') || s.contains('\n') {
        format!("\"{}\"", s.replace('"', "\"\""))
    } else { s.to_string() }
}
