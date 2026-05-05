import { useState, useMemo } from "react";
import * as XLSX from "xlsx";
import {
  MemberFull, addMember, updateMember, deleteMember,
  batchImportMembers, recharge, getRecharges, RechargeItem,
} from "../db";

interface Props {
  members: MemberFull[];
  onReload: () => void;
}

export default function MemberPage({ members, onReload }: Props) {
  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<MemberFull | null>(null);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [level, setLevel] = useState("普通");
  const [balance, setBalance] = useState("0");
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [toast, setToast] = useState("");

  // 充值弹窗
  const [showRecharge, setShowRecharge] = useState<MemberFull | null>(null);
  const [rechargeAmount, setRechargeAmount] = useState("");

  // Excel 导入
  const [showImport, setShowImport] = useState(false);
  const [importStep, setImportStep] = useState<"upload"|"mapping"|"preview"|"result">("upload");
  const [importData, setImportData] = useState<any[]>([]);
  const [importMapping, setImportMapping] = useState({name:"",phone:"",level:"",balance:"",note:""});
  const [importPreview, setImportPreview] = useState<any[]>([]);
  const [importResult, setImportResult] = useState<{ok:number;skip:number}|null>(null);

  const filtered = useMemo(() => {
    if (!search.trim()) return members;
    const kw = search.toLowerCase();
    return members.filter(m => m.name.includes(kw) || m.phone.includes(kw) || m.phone.includes(search));
  }, [members, search]);

  function openAdd() {
    setEditing(null); setName(""); setPhone(""); setLevel("普通"); setBalance("0"); setNote("");
    setError(""); setShowForm(true);
  }
  function openEdit(m: MemberFull) {
    setEditing(m); setName(m.name); setPhone(m.phone); setLevel(m.level);
    setBalance(String(m.balance)); setNote(m.note || ""); setError(""); setShowForm(true);
  }

  async function save() {
    if (!name.trim()) { setError("请输入姓名"); return; }
    if (!phone.trim()) { setError("请输入手机号"); return; }
    setSubmitting(true);
    try {
      if (editing) {
        await updateMember(editing.id, { name: name.trim(), phone: phone.trim(), level, balance: parseFloat(balance)||0, note: note.trim() });
      } else {
        await addMember({ name: name.trim(), phone: phone.trim(), level, balance: parseFloat(balance)||0, note: note.trim() });
      }
      setShowForm(false); onReload();
    } catch (e: any) { setError(String(e)); }
    finally { setSubmitting(false); }
  }

  async function doDelete(m: MemberFull) {
    if (!confirm(`确定删除会员「${m.name}」吗？此操作不可恢复。`)) return;
    try { await deleteMember(m.id); onReload(); } catch (e) { setToast("删除失败: "+e); }
  }

  async function doRecharge() {
    if (!showRecharge || !rechargeAmount) return;
    const amt = parseFloat(rechargeAmount);
    if (isNaN(amt) || amt <= 0) { setToast("请输入有效金额"); return; }
    try {
      await recharge(showRecharge.id, amt, "充值");
      setShowRecharge(null); setRechargeAmount("");
      onReload();
      setToast(`成功为 ${showRecharge.name} 充值 ¥${amt}`);
    } catch (e) { setToast("充值失败: "+e); }
  }

  // Excel 导入
  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const wb = XLSX.read(new Uint8Array(ev.target!.result as ArrayBuffer), {type:"array"});
      const rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]]);
      setImportData(rows);
      const cols = Object.keys(rows[0] || {});
      setImportMapping({
        name: cols.find(c => c.includes("姓名")||c.toLowerCase().includes("name")) || cols[0]||"",
        phone: cols.find(c => c.includes("手机")||c.includes("电话")||c.toLowerCase().includes("phone")) || cols[1]||"",
        level: cols.find(c => c.includes("等级")||c.includes("级别")) || "",
        balance: cols.find(c => c.includes("余额")||c.includes("金额")) || "",
        note: cols.find(c => c.includes("备注")||c.toLowerCase().includes("note")) || "",
      });
      setImportStep("mapping");
    };
    reader.readAsArrayBuffer(file);
  }

  function previewImport() {
    const preview = importData.map((r: any) => ({
      name: String(r[importMapping.name]||"").trim(),
      phone: String(r[importMapping.phone]||"").trim(),
      level: String(r[importMapping.level]||"普通").trim() || "普通",
      balance: parseFloat(r[importMapping.balance]) || 0,
      note: String(r[importMapping.note]||"").trim(),
    })).filter((m: any) => m.name && m.phone);
    setImportPreview(preview); setImportStep("preview");
  }

  async function doImport() {
    try {
      const [ok, skip] = await batchImportMembers(importPreview);
      setImportResult({ ok, skip }); setImportStep("result"); onReload();
    } catch (e) { setToast("导入失败: "+e); }
  }

  return (
    <div className="page">
      {toast && <div className="toast" onClick={() => setToast("")}>{toast}</div>}

      <div className="page-header">
        <h2>👥 会员管理 ({members.length})</h2>
        <div className="page-actions">
          <input className="input" placeholder="搜索会员..." value={search} onChange={e => setSearch(e.target.value)} />
          <button className="btn btn-outline" onClick={() => setShowImport(true)}>📥 导入Excel</button>
          <button className="btn btn-primary" onClick={openAdd}>+ 新增会员</button>
        </div>
      </div>

      <div className="table-wrap">
        <table className="table">
          <thead>
            <tr><th>姓名</th><th>手机号</th><th>等级</th><th>余额</th><th>累计消费</th><th>备注</th><th>注册时间</th><th>操作</th></tr>
          </thead>
          <tbody>
            {filtered.map(m => (
              <tr key={m.id}>
                <td><strong>{m.name}</strong></td>
                <td>{m.phone}</td>
                <td><span className={`level-tag level-${m.level}`}>{m.level}</span></td>
                <td className="money">¥{m.balance.toFixed(2)}</td>
                <td className="money">¥{(m.total_spent||0).toFixed(2)}</td>
                <td className="note">{m.note}</td>
                <td className="date">{m.created_at?.slice(0,10)}</td>
                <td className="actions">
                  <button className="btn btn-sm btn-outline" onClick={() => openEdit(m)}>编辑</button>
                  <button className="btn btn-sm btn-success" onClick={() => { setShowRecharge(m); setRechargeAmount(""); }}>充值</button>
                  <button className="btn btn-sm btn-danger" onClick={() => doDelete(m)}>删除</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {filtered.length === 0 && <div className="empty-state">暂无会员</div>}
      </div>

      {/* 新增/编辑弹窗 */}
      {showForm && (
        <div className="modal-overlay" onClick={() => setShowForm(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h3>{editing ? "编辑会员" : "新增会员"}</h3>
            {error && <div className="form-error">{error}</div>}
            <label>姓名</label>
            <input className="input" value={name} onChange={e => setName(e.target.value)} />
            <label>手机号</label>
            <input className="input" value={phone} onChange={e => setPhone(e.target.value)} />
            <label>等级</label>
            <select className="input" value={level} onChange={e => setLevel(e.target.value)}>
              <option>普通</option><option>银卡</option><option>金卡</option><option>钻石</option>
            </select>
            <label>余额</label>
            <input className="input" type="number" value={balance} onChange={e => setBalance(e.target.value)} />
            <label>备注</label>
            <input className="input" value={note} onChange={e => setNote(e.target.value)} />
            <div className="modal-actions">
              <button className="btn" onClick={() => setShowForm(false)}>取消</button>
              <button className="btn btn-primary" onClick={save} disabled={submitting}>{submitting?"保存中...":"保存"}</button>
            </div>
          </div>
        </div>
      )}

      {/* 充值弹窗 */}
      {showRecharge && (
        <div className="modal-overlay" onClick={() => setShowRecharge(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h3>充值 - {showRecharge.name}</h3>
            <p>当前余额：¥{showRecharge.balance.toFixed(2)}</p>
            <label>充值金额</label>
            <input className="input input-lg" type="number" value={rechargeAmount} onChange={e => setRechargeAmount(e.target.value)} autoFocus />
            <div className="modal-actions">
              <button className="btn" onClick={() => setShowRecharge(null)}>取消</button>
              <button className="btn btn-success" onClick={doRecharge}>确认充值</button>
            </div>
          </div>
        </div>
      )}

      {/* Excel 导入弹窗 */}
      {showImport && (
        <div className="modal-overlay" onClick={() => setShowImport(false)}>
          <div className="modal modal-lg" onClick={e => e.stopPropagation()}>
            <h3>📥 导入会员</h3>
            {importStep === "upload" && (
              <div>
                <p>请选择 .xlsx 或 .xls 文件</p>
                <input type="file" accept=".xlsx,.xls" onChange={handleFile} />
              </div>
            )}
            {importStep === "mapping" && (
              <div>
                <p>请确认列映射：</p>
                {(["name","phone","level","balance","note"] as const).map(f => (
                  <div key={f} className="form-row">
                    <label>{f==="name"?"姓名":f==="phone"?"手机号":f==="level"?"等级":f==="balance"?"余额":"备注"}</label>
                    <select className="input" value={importMapping[f]} onChange={e => setImportMapping({...importMapping, [f]: e.target.value})}>
                      <option value="">不映射</option>
                      {Object.keys(importData[0]||{}).map(col => <option key={col} value={col}>{col}</option>)}
                    </select>
                  </div>
                ))}
                <button className="btn btn-primary" onClick={previewImport}>预览</button>
              </div>
            )}
            {importStep === "preview" && (
              <div>
                <p>共 {importPreview.length} 条数据，预览前10条：</p>
                <table className="table"><thead><tr><th>姓名</th><th>手机号</th><th>等级</th><th>余额</th></tr></thead>
                  <tbody>{importPreview.slice(0,10).map((m:any,i:number) => (
                    <tr key={i}><td>{m.name}</td><td>{m.phone}</td><td>{m.level}</td><td>¥{m.balance}</td></tr>
                  ))}</tbody>
                </table>
                <button className="btn btn-success" onClick={doImport}>确认导入</button>
              </div>
            )}
            {importStep === "result" && importResult && (
              <div>
                <p>✅ 导入完成！成功 {importResult.ok} 条，跳过 {importResult.skip} 条（重复）</p>
                <button className="btn btn-primary" onClick={() => setShowImport(false)}>关闭</button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
