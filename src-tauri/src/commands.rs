use rusqlite::Connection;
use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use rust_xlsxwriter::{Workbook, Format, FormatAlign, Color};

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
    pub note: String,
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
    pub order_id: i64,
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

#[derive(Deserialize)]
pub struct ImportMember {
    pub name: String,
    pub phone: String,
    pub level: Option<String>,
    pub balance: Option<f64>,
    pub note: Option<String>,
    pub total_spent: Option<f64>,
}

#[derive(Deserialize)]
pub struct CustomService {
    pub name: String,
    pub price: f64,
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
            created_at: row.get(6)?, note: row.get(7)?, last_visit: row.get(8)?,
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
            created_at: row.get(6)?, note: row.get(7)?, last_visit: row.get(8)?,
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
    c.execute("BEGIN", []).map_err(|e| e.to_string())?;
    let result = (|| -> Result<(), String> {
        c.execute("DELETE FROM records WHERE member_id=?1", rusqlite::params![id]).map_err(|e| e.to_string())?;
        c.execute("DELETE FROM recharges WHERE member_id=?1", rusqlite::params![id]).map_err(|e| e.to_string())?;
        c.execute("DELETE FROM members WHERE id=?1", rusqlite::params![id]).map_err(|e| e.to_string())?;
        Ok(())
    })();
    match result {
        Ok(()) => { c.execute("COMMIT", []).map_err(|e| e.to_string())?; Ok(()) }
        Err(e) => { let _ = c.execute("ROLLBACK", []); Err(e) }
    }
}

#[tauri::command]
pub fn batch_import_members(db_path: tauri::State<PathBuf>, members: Vec<ImportMember>) -> Result<(usize, usize), String> {
    let c = conn(db_path.inner())?;
    let mut ok = 0;
    let mut skip = 0;
    for m in members {
        let exists: bool = c.query_row("SELECT 1 FROM members WHERE phone=?1", rusqlite::params![m.phone], |_| Ok(true)).unwrap_or(false);
        if exists { skip += 1; continue; }
        let balance = m.balance.unwrap_or(0.0);
        match c.execute(
            "INSERT INTO members (name, phone, level, balance, note, total_spent) VALUES (?1,?2,?3,?4,?5,?6)",
            rusqlite::params![m.name, m.phone, m.level.unwrap_or("普通".into()), balance, m.note.unwrap_or("".into()), m.total_spent.unwrap_or(0.0)],
        ) {
            Ok(_) => {
                ok += 1;
                // 若导入时余额 > 0，自动插入初始充值记录以便统计储值总额
                if balance > 0.0 {
                    let member_id: i64 = c.last_insert_rowid();
                    let _ = c.execute(
                        "INSERT INTO recharges (member_id, amount, note) VALUES (?1,?2,'导入初始余额')",
                        rusqlite::params![member_id, balance],
                    );
                }
            }
            Err(_) => skip += 1
        }
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

// ── 消费记录命令 ──

#[tauri::command]
pub fn get_records(db_path: tauri::State<PathBuf>, member_id: Option<i32>, limit: Option<i32>) -> Result<Vec<Record>, String> {
    let c = conn(db_path.inner())?;
    let records = if let Some(mid) = member_id {
        if let Some(lim) = limit {
            let mut stmt = c.prepare(
                "SELECT r.id, COALESCE(r.order_id,0), r.member_id, r.member_name, COALESCE(r.service_id,0), r.service_name, r.amount,
                        r.payment_method, COALESCE(r.note,''), r.created_at
                 FROM records r WHERE r.member_id=?1 ORDER BY r.created_at DESC LIMIT ?2"
            ).map_err(|e| e.to_string())?;
            let rows = stmt.query_map(rusqlite::params![mid, lim], |row| {
                Ok(Record {
                    id: row.get(0)?, order_id: row.get(1)?, member_id: row.get(2)?, member_name: row.get(3)?,
                    service_id: row.get(4)?, service_name: row.get(5)?, amount: row.get(6)?,
                    payment_method: row.get(7)?, note: row.get(8)?, created_at: row.get(9)?,
                })
            }).map_err(|e| e.to_string())?;
            rows.collect::<Result<Vec<_>, _>>().map_err(|e| e.to_string())?
        } else {
            let mut stmt = c.prepare(
                "SELECT r.id, COALESCE(r.order_id,0), r.member_id, r.member_name, COALESCE(r.service_id,0), r.service_name, r.amount,
                        r.payment_method, COALESCE(r.note,''), r.created_at
                 FROM records r WHERE r.member_id=?1 ORDER BY r.created_at DESC"
            ).map_err(|e| e.to_string())?;
            let rows = stmt.query_map(rusqlite::params![mid], |row| {
                Ok(Record {
                    id: row.get(0)?, order_id: row.get(1)?, member_id: row.get(2)?, member_name: row.get(3)?,
                    service_id: row.get(4)?, service_name: row.get(5)?, amount: row.get(6)?,
                    payment_method: row.get(7)?, note: row.get(8)?, created_at: row.get(9)?,
                })
            }).map_err(|e| e.to_string())?;
            rows.collect::<Result<Vec<_>, _>>().map_err(|e| e.to_string())?
        }
    } else {
        if let Some(lim) = limit {
            let mut stmt = c.prepare(
                "SELECT r.id, COALESCE(r.order_id,0), r.member_id, r.member_name, COALESCE(r.service_id,0), r.service_name, r.amount,
                        r.payment_method, COALESCE(r.note,''), r.created_at
                 FROM records r ORDER BY r.created_at DESC LIMIT ?1"
            ).map_err(|e| e.to_string())?;
            let rows = stmt.query_map([lim], |row| {
                Ok(Record {
                    id: row.get(0)?, order_id: row.get(1)?, member_id: row.get(2)?, member_name: row.get(3)?,
                    service_id: row.get(4)?, service_name: row.get(5)?, amount: row.get(6)?,
                    payment_method: row.get(7)?, note: row.get(8)?, created_at: row.get(9)?,
                })
            }).map_err(|e| e.to_string())?;
            rows.collect::<Result<Vec<_>, _>>().map_err(|e| e.to_string())?
        } else {
            let mut stmt = c.prepare(
                "SELECT r.id, COALESCE(r.order_id,0), r.member_id, r.member_name, COALESCE(r.service_id,0), r.service_name, r.amount,
                        r.payment_method, COALESCE(r.note,''), r.created_at
                 FROM records r ORDER BY r.created_at DESC"
            ).map_err(|e| e.to_string())?;
            let rows = stmt.query_map([], |row| {
                Ok(Record {
                    id: row.get(0)?, order_id: row.get(1)?, member_id: row.get(2)?, member_name: row.get(3)?,
                    service_id: row.get(4)?, service_name: row.get(5)?, amount: row.get(6)?,
                    payment_method: row.get(7)?, note: row.get(8)?, created_at: row.get(9)?,
                })
            }).map_err(|e| e.to_string())?;
            rows.collect::<Result<Vec<_>, _>>().map_err(|e| e.to_string())?
        }
    };
    Ok(records)
}

#[tauri::command]
pub fn delete_record(db_path: tauri::State<PathBuf>, id: i32) -> Result<(), String> {
    let c = conn(db_path.inner())?;
    c.execute("DELETE FROM records WHERE id=?1", rusqlite::params![id]).map_err(|e| e.to_string())?;
    Ok(())
}

// ── 收银结账命令 ──

#[tauri::command]
pub fn checkout(
    db_path: tauri::State<PathBuf>,
    member_id: i32,
    service_ids: Vec<i32>,
    custom_services: Vec<CustomService>,
    payment_method: String,
    note: String,
) -> Result<CheckoutReceipt, String> {
    let c = conn(db_path.inner())?;

    // 事务保护
    c.execute("BEGIN", []).map_err(|e| e.to_string())?;
    let result = (|| -> Result<CheckoutReceipt, String> {
        // 获取会员信息
        let (member_name, old_balance): (String, f64) = c.query_row(
            "SELECT name, balance FROM members WHERE id=?1",
            rusqlite::params![member_id],
            |row| Ok((row.get(0)?, row.get(1)?)),
        ).map_err(|e| e.to_string())?;

        // 生成订单号（时间戳毫秒）
        let order_id: i64 = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap_or_default()
            .as_millis() as i64;

        // 计算总价
        let mut service_names: Vec<String> = Vec::new();
        let mut total = 0.0;

        // 预设服务
        for sid in &service_ids {
            let (sname, sprice): (String, f64) = c.query_row(
                "SELECT name, price FROM services WHERE id=?1",
                rusqlite::params![sid],
                |row| Ok((row.get(0)?, row.get(1)?)),
            ).map_err(|e| format!("服务ID {} 不存在: {}", sid, e))?;

            service_names.push(sname.clone());
            total += sprice;

            c.execute(
                "INSERT INTO records (order_id, member_id, service_id, member_name, service_name, amount, payment_method, note)
                 VALUES (?1,?2,?3,?4,?5,?6,?7,?8)",
                rusqlite::params![order_id, member_id, sid, member_name, sname, sprice, payment_method, note],
            ).map_err(|e| e.to_string())?;
        }

        // 自定义服务（service_id=0 标识临时服务）
        for cs in &custom_services {
            service_names.push(cs.name.clone());
            total += cs.price;

            c.execute(
                "INSERT INTO records (order_id, member_id, service_id, member_name, service_name, amount, payment_method, note)
                 VALUES (?1,?2,0,?3,?4,?5,?6,?7)",
                rusqlite::params![order_id, member_id, member_name, cs.name, cs.price, payment_method, note],
            ).map_err(|e| e.to_string())?;
        }

        let mut new_balance = old_balance;

        // 余额支付：扣减余额
        let is_balance_pay = payment_method == "余额" || payment_method == "balance";
        if is_balance_pay {
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

        Ok(CheckoutReceipt {
            member_name,
            services: service_names,
            original: (total * 100.0).round() / 100.0,
            discount: 0.0,
            total: (total * 100.0).round() / 100.0,
            payment_method,
            old_balance: (old_balance * 100.0).round() / 100.0,
            new_balance: (new_balance * 100.0).round() / 100.0,
        })
    })();

    match result {
        Ok(receipt) => {
            c.execute("COMMIT", []).map_err(|e| e.to_string())?;
            Ok(receipt)
        }
        Err(e) => {
            let _ = c.execute("ROLLBACK", []);
            Err(e)
        }
    }
}

// ── 充值命令 ──

#[tauri::command]
pub fn recharge(db_path: tauri::State<PathBuf>, member_id: i32, amount: f64, note: String) -> Result<f64, String> {
    let c = conn(db_path.inner())?;
    c.execute("BEGIN", []).map_err(|e| e.to_string())?;
    let result = (|| -> Result<f64, String> {
        c.execute("INSERT INTO recharges (member_id, amount, note) VALUES (?1,?2,?3)",
            rusqlite::params![member_id, amount, note]).map_err(|e| e.to_string())?;
        c.execute("UPDATE members SET balance=balance+?1 WHERE id=?2",
            rusqlite::params![amount, member_id]).map_err(|e| e.to_string())?;
        let new_balance: f64 = c.query_row("SELECT balance FROM members WHERE id=?1",
            rusqlite::params![member_id], |row| row.get(0)).map_err(|e| e.to_string())?;
        Ok(new_balance)
    })();
    match result {
        Ok(bal) => { c.execute("COMMIT", []).map_err(|e| e.to_string())?; Ok(bal) }
        Err(e) => { let _ = c.execute("ROLLBACK", []); Err(e) }
    }
}

#[tauri::command]
pub fn get_recharges(db_path: tauri::State<PathBuf>, member_id: Option<i32>) -> Result<Vec<Recharge>, String> {
    let c = conn(db_path.inner())?;
    let recharges = if let Some(mid) = member_id {
        let mut stmt = c.prepare(
            "SELECT id, member_id, amount, COALESCE(note,''), created_at FROM recharges WHERE member_id=?1 ORDER BY created_at DESC"
        ).map_err(|e| e.to_string())?;
        let rows = stmt.query_map(rusqlite::params![mid], |row| {
            Ok(Recharge { id: row.get(0)?, member_id: row.get(1)?, amount: row.get(2)?, note: row.get(3)?, created_at: row.get(4)? })
        }).map_err(|e| e.to_string())?;
        rows.collect::<Result<Vec<_>, _>>().map_err(|e| e.to_string())?
    } else {
        // 全量查询，用于统计储值总额（不限条数）
        let mut stmt = c.prepare(
            "SELECT id, member_id, amount, COALESCE(note,''), created_at FROM recharges ORDER BY created_at DESC"
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
    let (y, mo, d, h, mi, s) = epoch_to_local();
    format!("{:04}-{:02}-{:02}T{:02}:{:02}:{:02}", y, mo, d, h, mi, s)
}

fn get_members_impl(c: &Connection) -> Result<Vec<MemberFull>, String> {
    let mut stmt = c.prepare(
        "SELECT id,name,phone,level,balance,total_spent,created_at,COALESCE(note,'') FROM members ORDER BY id"
    ).map_err(|e| e.to_string())?;
    let rows = stmt.query_map([], |row| {
        Ok(MemberFull {
            id: row.get(0)?, name: row.get(1)?, phone: row.get(2)?,
            level: row.get(3)?, balance: row.get(4)?, total_spent: row.get(5)?,
            created_at: row.get(6)?, note: row.get(7)?, last_visit: None,
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
    if let Some(mid) = member_id {
        if let Some(lim) = limit {
            let mut stmt = c.prepare(
                "SELECT id,COALESCE(order_id,0),member_id,member_name,COALESCE(service_id,0),service_name,amount,
                        payment_method,COALESCE(note,''),created_at
                 FROM records WHERE member_id=?1 ORDER BY created_at DESC LIMIT ?2"
            ).map_err(|e| e.to_string())?;
            let rows = stmt.query_map(rusqlite::params![mid, lim], |row| {
                Ok(Record { id: row.get(0)?, order_id: row.get(1)?, member_id: row.get(2)?, member_name: row.get(3)?,
                    service_id: row.get(4)?, service_name: row.get(5)?, amount: row.get(6)?,
                    payment_method: row.get(7)?, note: row.get(8)?, created_at: row.get(9)? })
            }).map_err(|e| e.to_string())?;
            rows.collect::<Result<Vec<_>, _>>().map_err(|e| e.to_string())
        } else {
            let mut stmt = c.prepare(
                "SELECT id,COALESCE(order_id,0),member_id,member_name,COALESCE(service_id,0),service_name,amount,
                        payment_method,COALESCE(note,''),created_at
                 FROM records WHERE member_id=?1 ORDER BY created_at DESC"
            ).map_err(|e| e.to_string())?;
            let rows = stmt.query_map(rusqlite::params![mid], |row| {
                Ok(Record { id: row.get(0)?, order_id: row.get(1)?, member_id: row.get(2)?, member_name: row.get(3)?,
                    service_id: row.get(4)?, service_name: row.get(5)?, amount: row.get(6)?,
                    payment_method: row.get(7)?, note: row.get(8)?, created_at: row.get(9)? })
            }).map_err(|e| e.to_string())?;
            rows.collect::<Result<Vec<_>, _>>().map_err(|e| e.to_string())
        }
    } else {
        if let Some(lim) = limit {
            let mut stmt = c.prepare(
                "SELECT id,COALESCE(order_id,0),member_id,member_name,COALESCE(service_id,0),service_name,amount,
                        payment_method,COALESCE(note,''),created_at
                 FROM records ORDER BY created_at DESC LIMIT ?1"
            ).map_err(|e| e.to_string())?;
            let rows = stmt.query_map([lim], |row| {
                Ok(Record { id: row.get(0)?, order_id: row.get(1)?, member_id: row.get(2)?, member_name: row.get(3)?,
                    service_id: row.get(4)?, service_name: row.get(5)?, amount: row.get(6)?,
                    payment_method: row.get(7)?, note: row.get(8)?, created_at: row.get(9)? })
            }).map_err(|e| e.to_string())?;
            rows.collect::<Result<Vec<_>, _>>().map_err(|e| e.to_string())
        } else {
            let mut stmt = c.prepare(
                "SELECT id,COALESCE(order_id,0),member_id,member_name,COALESCE(service_id,0),service_name,amount,
                        payment_method,COALESCE(note,''),created_at
                 FROM records ORDER BY created_at DESC"
            ).map_err(|e| e.to_string())?;
            let rows = stmt.query_map([], |row| {
                Ok(Record { id: row.get(0)?, order_id: row.get(1)?, member_id: row.get(2)?, member_name: row.get(3)?,
                    service_id: row.get(4)?, service_name: row.get(5)?, amount: row.get(6)?,
                    payment_method: row.get(7)?, note: row.get(8)?, created_at: row.get(9)? })
            }).map_err(|e| e.to_string())?;
            rows.collect::<Result<Vec<_>, _>>().map_err(|e| e.to_string())
        }
    }
}

fn get_recharges_impl(c: &Connection, member_id: Option<i32>) -> Result<Vec<Recharge>, String> {
    if let Some(mid) = member_id {
        let mut stmt = c.prepare(
            "SELECT id,member_id,amount,COALESCE(note,''),created_at FROM recharges WHERE member_id=?1 ORDER BY created_at DESC"
        ).map_err(|e| e.to_string())?;
        let rows = stmt.query_map(rusqlite::params![mid], |row| {
            Ok(Recharge { id: row.get(0)?, member_id: row.get(1)?, amount: row.get(2)?, note: row.get(3)?, created_at: row.get(4)? })
        }).map_err(|e| e.to_string())?;
        rows.collect::<Result<Vec<_>, _>>().map_err(|e| e.to_string())
    } else {
        let mut stmt = c.prepare(
            "SELECT id,member_id,amount,COALESCE(note,''),created_at FROM recharges ORDER BY created_at DESC"
        ).map_err(|e| e.to_string())?;
        let rows = stmt.query_map([], |row| {
            Ok(Recharge { id: row.get(0)?, member_id: row.get(1)?, amount: row.get(2)?, note: row.get(3)?, created_at: row.get(4)? })
        }).map_err(|e| e.to_string())?;
        rows.collect::<Result<Vec<_>, _>>().map_err(|e| e.to_string())
    }
}

// ── 备份配置 ──

#[derive(Serialize, Deserialize, Clone)]
pub struct BackupConfig {
    pub backup_dir: String,
    pub backup_keep_days: u32,
    pub backup_hour: u32,
}

#[tauri::command]
pub fn get_backup_config(db_path: tauri::State<PathBuf>) -> Result<BackupConfig, String> {
    let c = conn(db_path.inner())?;
    let get = |key: &str| -> String {
        c.query_row("SELECT value FROM settings WHERE key=?1", rusqlite::params![key], |r| r.get(0))
            .unwrap_or_default()
    };
    Ok(BackupConfig {
        backup_dir: get("backup_dir"),
        backup_keep_days: get("backup_keep_days").parse().unwrap_or(30),
        backup_hour: get("backup_hour").parse().unwrap_or(2),
    })
}

#[tauri::command]
pub fn save_backup_config(db_path: tauri::State<PathBuf>, config: BackupConfig) -> Result<(), String> {
    let c = conn(db_path.inner())?;
    let set = |key: &str, val: &str| -> Result<(), String> {
        c.execute("INSERT OR REPLACE INTO settings (key, value) VALUES (?1, ?2)",
            rusqlite::params![key, val]).map_err(|e| e.to_string())?;
        Ok(())
    };
    set("backup_dir", &config.backup_dir)?;
    set("backup_keep_days", &config.backup_keep_days.to_string())?;
    set("backup_hour", &config.backup_hour.to_string())?;
    Ok(())
}

// ── 每日自动备份 ──

#[derive(Serialize)]
pub struct BackupResult {
    pub backed_up: bool,
    pub path: String,
    pub message: String,
}

/// 写 xlsx 备份到指定路径（会员 + 消费记录 + 充值记录，三个工作表）
fn write_backup_xlsx(c: &Connection, filepath: &std::path::Path) -> Result<(usize, usize, usize), String> {
    let header_fmt = Format::new()
        .set_background_color(Color::RGB(0xC9952A))
        .set_font_color(Color::White)
        .set_bold()
        .set_align(FormatAlign::Center);
    let money_fmt = Format::new().set_num_format("0.00");

    let mut workbook = Workbook::new();

    // ── 工作表1：会员数据 ──
    {
        let mut stmt = c.prepare(
            "SELECT name, phone, balance, total_spent, created_at, COALESCE(note,'') FROM members ORDER BY id"
        ).map_err(|e| e.to_string())?;
        let rows: Vec<(String,String,f64,f64,String,String)> = stmt.query_map([], |row| {
            Ok((row.get(0)?, row.get(1)?, row.get(2)?, row.get(3)?, row.get(4)?, row.get(5)?))
        }).map_err(|e| e.to_string())?.collect::<Result<Vec<_>, _>>().map_err(|e| e.to_string())?;
        let _count = rows.len();

        let sheet = workbook.add_worksheet();
        sheet.set_name("会员数据").map_err(|e| e.to_string())?;
        let headers = ["姓名", "手机号", "余额", "累计消费", "注册时间", "备注"];
        let widths: [f64; 6] = [12.0, 15.0, 12.0, 12.0, 20.0, 20.0];
        for (i, h) in headers.iter().enumerate() {
            sheet.write_with_format(0, i as u16, *h, &header_fmt).map_err(|e| e.to_string())?;
            sheet.set_column_width(i as u16, widths[i]).map_err(|e| e.to_string())?;
        }
        sheet.set_row_height(0, 20.0).map_err(|e| e.to_string())?;
        for (ri, (name, phone, balance, total_spent, created_at, note)) in rows.iter().enumerate() {
            let r = (ri + 1) as u32;
            sheet.write(r, 0, name.as_str()).map_err(|e| e.to_string())?;
            sheet.write(r, 1, phone.as_str()).map_err(|e| e.to_string())?;
            sheet.write_with_format(r, 2, *balance, &money_fmt).map_err(|e| e.to_string())?;
            sheet.write_with_format(r, 3, *total_spent, &money_fmt).map_err(|e| e.to_string())?;
            sheet.write(r, 4, created_at.as_str()).map_err(|e| e.to_string())?;
            sheet.write(r, 5, note.as_str()).map_err(|e| e.to_string())?;
        }
    }

    // ── 工作表2：消费记录 ──
    {
        let mut stmt = c.prepare(
            "SELECT created_at, member_name, service_name, amount, payment_method, COALESCE(note,'')
             FROM records ORDER BY created_at DESC"
        ).map_err(|e| e.to_string())?;
        let rows: Vec<(String,String,String,f64,String,String)> = stmt.query_map([], |row| {
            Ok((row.get(0)?, row.get(1)?, row.get(2)?, row.get(3)?, row.get(4)?, row.get(5)?))
        }).map_err(|e| e.to_string())?.collect::<Result<Vec<_>, _>>().map_err(|e| e.to_string())?;
        let _count = rows.len();

        let sheet = workbook.add_worksheet();
        sheet.set_name("消费记录").map_err(|e| e.to_string())?;
        let headers = ["时间", "会员", "服务", "实付", "支付方式", "备注"];
        let widths: [f64; 6] = [20.0, 12.0, 14.0, 10.0, 10.0, 20.0];
        for (i, h) in headers.iter().enumerate() {
            sheet.write_with_format(0, i as u16, *h, &header_fmt).map_err(|e| e.to_string())?;
            sheet.set_column_width(i as u16, widths[i]).map_err(|e| e.to_string())?;
        }
        sheet.set_row_height(0, 20.0).map_err(|e| e.to_string())?;
        for (ri, (ca, mn, sn, am, pm, nt)) in rows.iter().enumerate() {
            let r = (ri + 1) as u32;
            sheet.write(r, 0, ca.as_str()).map_err(|e| e.to_string())?;
            sheet.write(r, 1, mn.as_str()).map_err(|e| e.to_string())?;
            sheet.write(r, 2, sn.as_str()).map_err(|e| e.to_string())?;
            sheet.write_with_format(r, 3, *am, &money_fmt).map_err(|e| e.to_string())?;
            sheet.write(r, 4, pm.as_str()).map_err(|e| e.to_string())?;
            sheet.write(r, 5, nt.as_str()).map_err(|e| e.to_string())?;
        }
    }

    // ── 工作表3：充值记录 ──
    {
        let mut stmt = c.prepare(
            "SELECT created_at, (SELECT name FROM members WHERE id=member_id), amount, COALESCE(note,'')
             FROM recharges ORDER BY created_at DESC"
        ).map_err(|e| e.to_string())?;
        let rows: Vec<(String,String,f64,String)> = stmt.query_map([], |row| {
            Ok((row.get(0)?, row.get::<_, String>(1).unwrap_or("未知".into()), row.get(2)?, row.get(3)?))
        }).map_err(|e| e.to_string())?.collect::<Result<Vec<_>, _>>().map_err(|e| e.to_string())?;
        let _count = rows.len();

        let sheet = workbook.add_worksheet();
        sheet.set_name("充值记录").map_err(|e| e.to_string())?;
        let headers = ["时间", "会员", "金额", "备注"];
        let widths: [f64; 4] = [20.0, 12.0, 12.0, 20.0];
        for (i, h) in headers.iter().enumerate() {
            sheet.write_with_format(0, i as u16, *h, &header_fmt).map_err(|e| e.to_string())?;
            sheet.set_column_width(i as u16, widths[i]).map_err(|e| e.to_string())?;
        }
        sheet.set_row_height(0, 20.0).map_err(|e| e.to_string())?;
        for (ri, (ca, mn, am, nt)) in rows.iter().enumerate() {
            let r = (ri + 1) as u32;
            sheet.write(r, 0, ca.as_str()).map_err(|e| e.to_string())?;
            sheet.write(r, 1, mn.as_str()).map_err(|e| e.to_string())?;
            sheet.write_with_format(r, 2, *am, &money_fmt).map_err(|e| e.to_string())?;
            sheet.write(r, 3, nt.as_str()).map_err(|e| e.to_string())?;
        }
    }

    workbook.save(filepath).map_err(|e| e.to_string())?;

    // 返回三个表的行数
    let count_m: usize = c.query_row("SELECT COUNT(*) FROM members", [], |r| r.get(0)).map_err(|e| e.to_string())?;
    let count_r: usize = c.query_row("SELECT COUNT(*) FROM records", [], |r| r.get(0)).map_err(|e| e.to_string())?;
    let count_rc: usize = c.query_row("SELECT COUNT(*) FROM recharges", [], |r| r.get(0)).map_err(|e| e.to_string())?;
    Ok((count_m, count_r, count_rc))
}

/// 清理过期的每日备份（仅匹配 backup_YYYY-MM-DD.xlsx，手动备份不参与清理）
fn cleanup_old_backups(backup_dir: &std::path::Path, keep_days: i64) -> Result<(), String> {
    use std::fs;
    use std::time::SystemTime;

    let secs = SystemTime::now()
        .duration_since(SystemTime::UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs() as i64 + 8 * 3600;
    let (cy, cm, cd) = ymd_from_total_days((secs / 86400) as i32 - keep_days as i32);
    let cutoff = format!("{:04}-{:02}-{:02}", cy, cm, cd);

    if let Ok(entries) = fs::read_dir(backup_dir) {
        for e in entries.filter_map(|e| e.ok()) {
            let n = e.file_name().to_string_lossy().to_string();
            if let Some(date) = daily_backup_date(&n) {
                if date.as_str() < cutoff.as_str() {
                    let _ = fs::remove_file(e.path());
                }
            }
        }
    }
    Ok(())
}

/// 从每日备份文件名 backup_YYYY-MM-DD.xlsx 解析出日期字符串；非每日备份返回 None
fn daily_backup_date(name: &str) -> Option<String> {
    let s = name.strip_prefix("backup_")?;
    let s = s.strip_suffix(".xlsx")?;
    if s.len() == 10 && s.as_bytes()[4] == b'-' && s.as_bytes()[7] == b'-' {
        Some(s.to_string())
    } else {
        None
    }
}

#[tauri::command]
pub fn daily_backup(db_path: tauri::State<PathBuf>, app_handle: tauri::AppHandle) -> Result<BackupResult, String> {
    use std::fs;
    use tauri::Manager;

    let c = conn(db_path.inner())?;

    // 读取配置
    let get_cfg = |key: &str, default: &str| -> String {
        c.query_row("SELECT value FROM settings WHERE key=?1", rusqlite::params![key], |r| r.get(0))
            .unwrap_or_else(|_| default.to_string())
    };
    let backup_dir_cfg = get_cfg("backup_dir", "");
    let keep_days: i64 = get_cfg("backup_keep_days", "30").parse().unwrap_or(30);
    let backup_hour: u32 = get_cfg("backup_hour", "2").parse().unwrap_or(2);

    // 判断当前小时是否已过备份时间点
    let now_hour = chrono_now_hour();
    if now_hour < backup_hour {
        return Ok(BackupResult {
            backed_up: false,
            path: "".to_string(),
            message: format!("未到备份时间（配置 {:02}:00）", backup_hour),
        });
    }

    // 确定备份目录
    let backup_dir = if backup_dir_cfg.is_empty() {
        let data_dir = app_handle.path().app_data_dir().map_err(|e| e.to_string())?;
        data_dir.join("backups")
    } else {
        PathBuf::from(&backup_dir_cfg)
    };
    fs::create_dir_all(&backup_dir).map_err(|e| e.to_string())?;

    // 清理过期每日备份（每次启动都执行）
    cleanup_old_backups(&backup_dir, keep_days)?;

    let today = chrono_now_str();
    let filename = format!("backup_{}.xlsx", today);
    let filepath = backup_dir.join(&filename);

    if filepath.exists() {
        return Ok(BackupResult {
            backed_up: false,
            path: filepath.to_string_lossy().to_string(),
            message: "今日已备份".to_string(),
        });
    }

    let (count_m, count_r, count_rc) = write_backup_xlsx(&c, &filepath)?;

    Ok(BackupResult {
        backed_up: true,
        path: filepath.to_string_lossy().to_string(),
        message: format!("已备份 {} 名会员，{} 条消费，{} 条充值", count_m, count_r, count_rc),
    })
}

#[tauri::command]
pub fn manual_backup(db_path: tauri::State<PathBuf>, app_handle: tauri::AppHandle) -> Result<BackupResult, String> {
    use std::fs;
    use tauri::Manager;

    let c = conn(db_path.inner())?;
    let backup_dir_cfg: String = c.query_row(
        "SELECT value FROM settings WHERE key='backup_dir'", [], |r| r.get(0)
    ).unwrap_or_default();

    let backup_dir = if backup_dir_cfg.is_empty() {
        let data_dir = app_handle.path().app_data_dir().map_err(|e| e.to_string())?;
        data_dir.join("backups")
    } else {
        PathBuf::from(&backup_dir_cfg)
    };
    fs::create_dir_all(&backup_dir).map_err(|e| e.to_string())?;

    let now = chrono_now_str_full();
    let filename = format!("backup_{}.xlsx", now);
    let filepath = backup_dir.join(&filename);

    let (count_m, count_r, count_rc) = write_backup_xlsx(&c, &filepath)?;

    Ok(BackupResult {
        backed_up: true,
        path: filepath.to_string_lossy().to_string(),
        message: format!("手动备份成功！会员 {}，消费 {}，充值 {}\n路径：{}", count_m, count_r, count_rc, filepath.to_string_lossy()),
    })
}

// ── 备份文件列表 / 打开目录 ──

#[derive(Serialize)]
pub struct BackupFileInfo {
    pub name: String,
    pub path: String,
    pub size: u64,
    pub modified: String,
}

fn resolve_backup_dir(app_handle: &tauri::AppHandle, backup_dir_cfg: &str) -> Result<PathBuf, String> {
    use tauri::Manager;
    if backup_dir_cfg.is_empty() {
        Ok(app_handle.path().app_data_dir().map_err(|e| e.to_string())?.join("backups"))
    } else {
        Ok(PathBuf::from(backup_dir_cfg))
    }
}

/// 将 Unix 秒（UTC+8）格式化为 "YYYY-MM-DD HH:MM:SS"
fn format_unix_utc8(secs: i64) -> String {
    let secs = secs + 8 * 3600;
    let sec = (secs % 60) as u32;
    let min = ((secs / 60) % 60) as u32;
    let hour = ((secs / 3600) % 24) as u32;
    let (y, mo, d) = ymd_from_total_days((secs / 86400) as i32);
    format!("{:04}-{:02}-{:02} {:02}:{:02}:{:02}", y, mo, d, hour, min, sec)
}

#[tauri::command]
pub fn list_backups(db_path: tauri::State<PathBuf>, app_handle: tauri::AppHandle) -> Result<Vec<BackupFileInfo>, String> {
    use std::fs;
    use std::time::UNIX_EPOCH;

    let c = conn(db_path.inner())?;
    let backup_dir_cfg: String = c.query_row(
        "SELECT value FROM settings WHERE key='backup_dir'", [], |r| r.get(0)
    ).unwrap_or_default();
    let backup_dir = resolve_backup_dir(&app_handle, &backup_dir_cfg)?;

    let mut files: Vec<BackupFileInfo> = Vec::new();
    if let Ok(entries) = fs::read_dir(&backup_dir) {
        for e in entries.filter_map(|e| e.ok()) {
            let name = e.file_name().to_string_lossy().to_string();
            if !(name.starts_with("backup_") && name.ends_with(".xlsx")) { continue; }
            let md = e.metadata().map_err(|e| e.to_string())?;
            let modified = md.modified()
                .ok()
                .and_then(|m| m.duration_since(UNIX_EPOCH).ok())
                .map(|d| format_unix_utc8(d.as_secs() as i64))
                .unwrap_or_default();
            files.push(BackupFileInfo {
                name,
                path: e.path().to_string_lossy().to_string(),
                size: md.len(),
                modified,
            });
        }
    }
    files.sort_by(|a, b| b.modified.cmp(&a.modified));
    Ok(files)
}

#[tauri::command]
pub fn reveal_backup(db_path: tauri::State<PathBuf>, app_handle: tauri::AppHandle, path: String) -> Result<(), String> {
    let c = conn(db_path.inner())?;
    let backup_dir_cfg: String = c.query_row(
        "SELECT value FROM settings WHERE key='backup_dir'", [], |r| r.get(0)
    ).unwrap_or_default();
    let backup_dir = resolve_backup_dir(&app_handle, &backup_dir_cfg)?;

    let p = std::path::Path::new(&path);
    if !p.is_file() { return Err("备份文件不存在".to_string()); }
    if !p.starts_with(&backup_dir) { return Err("无效的备份路径".to_string()); }

    #[cfg(target_os = "macos")]
    {
        std::process::Command::new("open").arg("-R").arg(&path).spawn().map_err(|e| e.to_string())?;
    }
    #[cfg(target_os = "windows")]
    {
        std::process::Command::new("explorer").args(["/select,", &path]).spawn().map_err(|e| e.to_string())?;
    }
    #[cfg(not(any(target_os = "macos", target_os = "windows")))]
    {
        let dir = p.parent().unwrap_or(&backup_dir);
        std::process::Command::new("xdg-open").arg(dir).spawn().map_err(|e| e.to_string())?;
    }
    Ok(())
}

fn chrono_now_str() -> String {
    use std::time::SystemTime;
    let (year, month, day, _, _, _) = epoch_to_local();
    let _ = SystemTime::now(); // suppress unused warning
    format!("{:04}-{:02}-{:02}", year, month, day)
}

fn chrono_now_str_full() -> String {
    let (year, month, day, hour, min, sec) = epoch_to_local();
    format!("{:04}{:02}{:02}_{:02}{:02}{:02}", year, month, day, hour, min, sec)
}

fn chrono_now_hour() -> u32 {
    epoch_to_local().3
}

/// 将 Unix 秒转换为 (year, month, day, hour, min, sec) UTC+8
fn epoch_to_local() -> (i32, u32, u32, u32, u32, u32) {
    use std::time::SystemTime;
    let secs = SystemTime::now()
        .duration_since(SystemTime::UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs() as i64 + 8 * 3600; // UTC+8

    let sec = (secs % 60) as u32;
    let min = ((secs / 60) % 60) as u32;
    let hour = ((secs / 3600) % 24) as u32;
    let (y, m, d) = ymd_from_total_days((secs / 86400) as i32);
    (y, m, d, hour, min, sec)
}

/// 将 1970-01-01 起的天数转换为 (年, 月, 日)
fn ymd_from_total_days(total_days: i32) -> (i32, u32, u32) {
    let mut year = 1970i32;
    let mut remaining = total_days;
    loop {
        let diy = if is_leap(year) { 366 } else { 365 };
        if remaining < diy { break; }
        remaining -= diy;
        year += 1;
    }
    let mdays = if is_leap(year) {
        [31i32, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]
    } else {
        [31i32, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]
    };
    let mut month = 1u32;
    for &md in mdays.iter() {
        if remaining < md { break; }
        remaining -= md;
        month += 1;
    }
    (year, month, (remaining + 1) as u32)
}

fn is_leap(y: i32) -> bool { (y % 4 == 0 && y % 100 != 0) || (y % 400 == 0) }

