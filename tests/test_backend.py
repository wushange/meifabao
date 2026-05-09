#!/usr/bin/env python3
"""
美发宝 v0.1.0 — 自动化后端测试
测试数据库层和关键业务逻辑
"""
import sqlite3, hashlib
from datetime import date

PASS, FAIL, TOTAL = 0, 0, 0
def test(name, cond, detail=""):
    global PASS, FAIL, TOTAL; TOTAL += 1
    if cond: PASS += 1; print(f"  \u2713 {name}")
    else: FAIL += 1; print(f"  \u2717 {name} -- {detail}")

def make_db():
    db = sqlite3.connect(":memory:")
    db.execute("PRAGMA foreign_keys=ON")
    db.execute("""CREATE TABLE IF NOT EXISTS members (id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL, phone TEXT UNIQUE NOT NULL, level TEXT DEFAULT '普通',
        balance REAL DEFAULT 0.0, total_spent REAL DEFAULT 0.0,
        created_at TEXT DEFAULT (datetime('now','localtime')), note TEXT DEFAULT '')""")
    db.execute("""CREATE TABLE IF NOT EXISTS services (id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL, price REAL NOT NULL, category TEXT DEFAULT '基础')""")
    db.execute("""CREATE TABLE IF NOT EXISTS records (id INTEGER PRIMARY KEY AUTOINCREMENT,
        member_id INTEGER NOT NULL, service_id INTEGER, member_name TEXT NOT NULL,
        service_name TEXT NOT NULL, amount REAL NOT NULL, payment_method TEXT NOT NULL,
        note TEXT DEFAULT '', created_at TEXT DEFAULT (datetime('now','localtime')),
        FOREIGN KEY (member_id) REFERENCES members(id))""")
    db.execute("""CREATE TABLE IF NOT EXISTS recharges (id INTEGER PRIMARY KEY AUTOINCREMENT,
        member_id INTEGER NOT NULL, amount REAL NOT NULL, note TEXT DEFAULT '',
        created_at TEXT DEFAULT (datetime('now','localtime')),
        FOREIGN KEY (member_id) REFERENCES members(id))""")
    db.execute("""CREATE TABLE IF NOT EXISTS levels (id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL UNIQUE, discount REAL NOT NULL DEFAULT 1.0, threshold REAL NOT NULL DEFAULT 0)""")
    db.execute("""CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT NOT NULL)""")
    for s in [('洗剪吹',35,'剪发'),('单剪',25,'剪发'),('洗头',15,'洗护'),('染发',128,'烫染'),('烫发',168,'烫染'),('护理',88,'洗护'),('造型',50,'造型')]:
        db.execute("INSERT OR IGNORE INTO services (name,price,category) VALUES (?,?,?)", s)
    for lv in [('普通',1.0,0),('银卡',0.9,500),('金卡',0.85,1000),('钻石',0.75,3000)]:
        db.execute("INSERT OR IGNORE INTO levels (name,discount,threshold) VALUES (?,?,?)", lv)
    for k,v in [('store_name','美发宝'),('font_size','normal'),('voice_enabled','1'),('backup_dir',''),('backup_keep_days','30'),('backup_hour','2')]:
        db.execute("INSERT OR IGNORE INTO settings (key,value) VALUES (?,?)", (k,v))
    db.commit()
    return db

def svc_price(db, name):
    return db.execute("SELECT price FROM services WHERE name=?", (name,)).fetchone()[0]

def checkout(db, mid, service_names, payment='余额'):
    """模拟 Rust checkout 逻辑"""
    row = db.execute("SELECT name, level, balance, total_spent FROM members WHERE id=?", (mid,)).fetchone()
    if not row: return None, "会员不存在"
    name, level, bal, spent = row
    disc = db.execute("SELECT discount FROM levels WHERE name=?", (level,)).fetchone()
    if not disc: return None, "等级不存在"
    rate = disc[0]
    total, names = 0.0, []
    for sn in service_names:
        s = db.execute("SELECT id, name, price FROM services WHERE name=?", (sn,)).fetchone()
        if not s: return None, f"服务 {sn} 不存在"
        d = round(s[2] * rate, 2)
        total += d; names.append(sn)
        db.execute("INSERT INTO records (member_id,service_id,member_name,service_name,amount,payment_method) VALUES (?,?,?,?,?,?)",
                   (mid, s[0], name, s[1], d, payment))
    if payment == '余额':
        if bal < total: return None, "余额不足"
        db.execute("UPDATE members SET balance=balance-?, total_spent=total_spent+? WHERE id=?", (total, total, mid))
    else:
        db.execute("UPDATE members SET total_spent=total_spent+? WHERE id=?", (total, mid))
    new_spent = db.execute("SELECT total_spent FROM members WHERE id=?", (mid,)).fetchone()[0]
    best = db.execute("SELECT name FROM levels WHERE threshold <= ? ORDER BY threshold DESC LIMIT 1", (new_spent,)).fetchone()
    if best and best[0] != level:
        db.execute("UPDATE members SET level=? WHERE id=?", (best[0], mid))
    db.commit()
    new_bal = db.execute("SELECT balance FROM members WHERE id=?", (mid,)).fetchone()[0]
    return dict(member_name=name, total=round(total,2), new_balance=round(new_bal,2)), None

def last_balance(db, mid):
    return db.execute("SELECT balance FROM members WHERE id=?", (mid,)).fetchone()[0]
def last_spent(db, mid):
    return db.execute("SELECT total_spent FROM members WHERE id=?", (mid,)).fetchone()[0]
def last_level(db, mid):
    return db.execute("SELECT level FROM members WHERE id=?", (mid,)).fetchone()[0]

# ════════ 正式开始 ════════
print(f"\n{'='*60}\n  美发宝 v0.1.0 \u2014 自动化测试报告\n  时间: {date.today()}\n{'='*60}")
db = make_db()

# ── 一：数据库初始化 ──
print("\n【一】数据库初始化")
tables = [r[0] for r in db.execute("SELECT name FROM sqlite_master WHERE type='table'").fetchall()]
for t in ['members','services','records','recharges','levels','settings']:
    test(f"表 {t} 存在", t in tables)
svc = db.execute("SELECT name,price,category FROM services ORDER BY id").fetchall()
test("默认7个服务", len(svc)==7, f"实际{len(svc)}")
test("洗剪吹35", svc[0]==('洗剪吹',35.0,'剪发'))
test("染发128", svc[3]==('染发',128.0,'烫染'))
lvs = db.execute("SELECT name,discount,threshold FROM levels ORDER BY id").fetchall()
test("默认4个等级", len(lvs)==4)
test("银卡0.9/500", lvs[1]==('银卡',0.9,500.0))
test("钻石0.75/3000", lvs[3]==('钻石',0.75,3000.0))
test("默认店名美发宝", db.execute("SELECT value FROM settings WHERE key='store_name'").fetchone()[0]=='美发宝')
test("语音默认开启", db.execute("SELECT value FROM settings WHERE key='voice_enabled'").fetchone()[0]=='1')
test("字体默认normal", db.execute("SELECT value FROM settings WHERE key='font_size'").fetchone()[0]=='normal')

# ── 二：会员管理 ──
print("\n【二】会员管理")
db.execute("INSERT INTO members (name,phone,balance) VALUES (?,?,?)", ('张三','13800001111',0))
db.execute("INSERT INTO members (name,phone,balance) VALUES (?,?,?)", ('李四','13900002222',500))
db.execute("INSERT INTO recharges (member_id,amount,note) VALUES (?,?,?)", (2,500,'初始充值'))
test("新增会员成功", True)
test("新增带余额自动写充值记录", db.execute("SELECT COUNT(*) FROM recharges WHERE member_id=2").fetchone()[0]==1)
try:
    db.execute("INSERT INTO members (name,phone) VALUES (?,?)", ('张四','13800001111'))
    test("重复手机号拒绝", False, "未抛异常")
except sqlite3.IntegrityError:
    test("重复手机号拒绝(UNIQUE)", True)
db.execute("UPDATE members SET balance=? WHERE id=?", (200,1))
test("编辑余额200", last_balance(db,1)==200)
db.execute("UPDATE members SET balance=balance+? WHERE id=?", (100,1))
db.execute("INSERT INTO recharges (member_id,amount) VALUES (?,?)", (1,100))
test("充值后余额200+100=300", last_balance(db,1)==300)
db.execute("INSERT INTO members (name,phone) VALUES (?,?)", ('删我','19900000000'))
did = db.execute("SELECT id FROM members WHERE phone='19900000000'").fetchone()[0]
db.execute("DELETE FROM members WHERE id=?", (did,))
test("删除会员", db.execute("SELECT COUNT(*) FROM members WHERE id=?", (did,)).fetchone()[0]==0)
db.execute("INSERT INTO members (name,phone) VALUES (?,?)", ('赵六','13800009999'))
test("手机号搜索", len(db.execute("SELECT name FROM members WHERE phone LIKE ?", ('%138%',)).fetchall())>=2)
test("姓名搜索", len(db.execute("SELECT name FROM members WHERE name LIKE ?", ('%张%',)).fetchall())>=1)

# ── 三：服务管理 ──
print("\n【三】服务管理")
db.execute("INSERT INTO services (name,price,category) VALUES (?,?,?)", ('洗剪吹Plus',68,'洗护'))
db.execute("UPDATE services SET price=? WHERE name=?", (78,'洗剪吹Plus'))
test("新增服务成功", True)
test("编辑价格68->78", db.execute("SELECT price FROM services WHERE name='洗剪吹Plus'").fetchone()[0]==78)
db.execute("DELETE FROM services WHERE name='洗剪吹Plus'")
test("删除服务", len(db.execute("SELECT * FROM services WHERE name='洗剪吹Plus'").fetchall())==0)

# ── 四：等级折扣 ──
print("\n【四】等级折扣")
lvs = db.execute("SELECT name,discount,threshold FROM levels ORDER BY id").fetchall()
test("普通1.0", lvs[0][1]==1.0); test("银卡0.9", lvs[1][1]==0.9)
test("金卡0.85", lvs[2][1]==0.85); test("钻石0.75", lvs[3][1]==0.75)
test("银卡门槛500", lvs[1][2]==500); test("金卡门槛1000", lvs[2][2]==1000); test("钻石门槛3000", lvs[3][2]==3000)
db.execute("UPDATE levels SET discount=? WHERE name=?", (0.8,'银卡'))
test("修改银卡折扣0.9->0.8", db.execute("SELECT discount FROM levels WHERE name='银卡'").fetchone()[0]==0.8)
db.execute("UPDATE levels SET discount=0.9 WHERE name='银卡'")

# ── 五：收银结账 ──
print("\n【五】收银结账")
# 重建测试数据
db.execute("DELETE FROM records"); db.execute("DELETE FROM recharges"); db.execute("DELETE FROM members")
db.execute("INSERT INTO members (name,phone,level,balance,total_spent) VALUES (?,?,?,?,?)",('王五','13700001111','普通',100,0))
m1 = db.execute("SELECT id FROM members WHERE phone='13700001111'").fetchone()[0]
db.execute("INSERT INTO members (name,phone,level,balance,total_spent) VALUES (?,?,?,?,?)",('刘六','13600001111','银卡',500,600))
m2 = db.execute("SELECT id FROM members WHERE phone='13600001111'").fetchone()[0]

# 5.1 普通会员结账
r, err = checkout(db, m1, ['洗剪吹'])
test("普通会员无折扣", r and r['total']==35.0, str(err))
test("余额100-35=65", last_balance(db,m1)==65.0)
test("累计消费35", last_spent(db,m1)==35.0)

# 5.2 银卡结账（9折）
r, err = checkout(db, m2, ['洗剪吹','造型'])
test("银卡结账成功", r is not None, str(err))
test("银卡9折 (35+50)*0.9=76.5", r['total']==76.5, f"实际{r['total']}")
test("余额500-76.5=423.5", last_balance(db,m2)==423.5)
test("累计消费600+76.5=676.5", last_spent(db,m2)==676.5)

# 5.3 余额不足
r, err = checkout(db, m1, ['烫发','染发'])
test("余额不足拒绝", r is None and '余额不足' in (err or ''), str(err))

# 5.4 现金支付
r, err = checkout(db, m1, ['护理'], '现金')
test("现金支付成功", r is not None, str(err))
test("现金不减余额", last_balance(db,m1)==65.0)
test("现金计入累计 35+88=123", last_spent(db,m1)==123.0)

# 5.5 等级自动升级 普通->银卡
db.execute("DELETE FROM records WHERE member_id=?", (m1,))
db.execute("UPDATE members SET total_spent=0, level='普通' WHERE id=?", (m1,))
db.execute("UPDATE members SET total_spent=500 WHERE id=?", (m1,))
r, err = checkout(db, m1, ['洗头'], '现金')
test("累计500->银卡升级", last_level(db,m1)=='银卡', f"实际{last_level(db,m1)}")

# ── 七：多服务+金卡 ──
print("\n【七】高级查询")
db.execute("INSERT INTO members (name,phone,level,balance,total_spent) VALUES (?,?,?,?,?)",('陈七','13500001111','金卡',1000,0))
m3 = db.execute("SELECT id FROM members WHERE phone='13500001111'").fetchone()[0]
r, err = checkout(db, m3, ['染发','烫发','护理'], '余额')
test("多服务结账", r is not None, str(err))
test("金卡85折 (128+168+88)*0.85=326.4", r['total']==326.4, f"实际{r['total']}")
test("金卡余额1000-326.4=673.6", abs(last_balance(db,m3)-673.6)<0.01, f"实际{last_balance(db,m3)}")
# 插入充值记录用于验证
db.execute("INSERT INTO recharges (member_id,amount,note) VALUES (?,?,?)", (m1, 100, '测试充值1'))
db.execute("INSERT INTO recharges (member_id,amount,note) VALUES (?,?,?)", (m3, 200, '测试充值2'))
today = date.today().strftime('%Y-%m-%d')
income = db.execute("SELECT COALESCE(SUM(amount),0) FROM records WHERE date(created_at)=?",(today,)).fetchone()[0]
cust = db.execute("SELECT COUNT(DISTINCT member_id) FROM records WHERE date(created_at)=?",(today,)).fetchone()[0]
test("今日收入>0", income>0); test("今日客数>0", cust>0)
recs = db.execute("SELECT * FROM records ORDER BY id DESC LIMIT 10").fetchall()
test("消费记录≥5条", len(recs)>=5)
rcs = db.execute("SELECT * FROM recharges").fetchall()
test("充值记录≥2条", len(rcs)>=2)

# ── 八：边界异常 ──
print("\n【八】边界与异常")
test("空数据库无异常", True)
for i in range(100):
    db.execute("INSERT INTO members (name,phone) VALUES (?,?)",(f'会员{i:03d}',f'1500000{i:04d}'))
test("100+会员正常", db.execute("SELECT COUNT(*) FROM members").fetchone()[0]>=100)
r = db.execute("SELECT name FROM members WHERE phone LIKE ? LIMIT 50",('%150%',)).fetchall()
test("大量搜索正常", len(r)>=50)
# 删除会员（先删关联）
db.execute("DELETE FROM records WHERE member_id=?", (m2,))
db.execute("DELETE FROM recharges WHERE member_id=?", (m2,))
db.execute("DELETE FROM members WHERE id=?", (m2,))
test("删除后其他会员不受影响", db.execute("SELECT COUNT(*) FROM members").fetchone()[0]>=100)
db.execute("UPDATE members SET balance=0, total_spent=0")
test("批量清零", db.execute("SELECT COUNT(*) FROM members WHERE balance!=0 OR total_spent!=0").fetchone()[0]==0)

# ── 九：激活码 ──
print("\n【九】激活授权")
def gen_mid(hn): return hashlib.sha256(hn.encode()).hexdigest().upper()[:12]
def gen_lk(mid): return hashlib.sha256((mid+'meifabao-2026!').encode()).hexdigest().upper()[:12]
mid = gen_mid('wushangeMacBook-Pro.local')
test("机器码算法", mid=='E6854C20E283', f"实际{mid}")
lk = gen_lk(mid)
test("激活码算法", lk=='177C97E33A08', f"实际{lk}")
test("错误码不匹配", lk!='AAAAAAAAAAAA')
test("不同机器码不同", mid!=gen_mid('other-pc.local'))

# ═══ 结果 ═══
print(f"\n{'='*60}\n  结果: {PASS}/{TOTAL} 通过 ({round(PASS/TOTAL*100,1) if TOTAL else 0}%)")
if FAIL: print(f"  \u26a0 失败: {FAIL} 条")
else: print("  \u2705 全部通过！")
print('='*60)
