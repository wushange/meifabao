import { useState } from "react";
import * as XLSX from "xlsx";
import { LevelInfo, updateLevel, exportAllData, clearAllData, batchImportMembers } from "../db";

interface Props {
  levels: LevelInfo[];
  onReload: () => void;
}

export default function SettingsPage({ levels, onReload }: Props) {
  const [toast, setToast] = useState("");

  // Excel 导入状态
  const [showImport, setShowImport] = useState(false);
  const [importStep, setImportStep] = useState<"upload"|"mapping"|"preview"|"result">("upload");
  const [importData, setImportData] = useState<any[]>([]);
  const [importMapping, setImportMapping] = useState({name:"",phone:"",level:"",balance:"",note:"",totalSpent:""});
  const [importPreview, setImportPreview] = useState<any[]>([]);
  const [importResult, setImportResult] = useState<{ok:number;skip:number}|null>(null);

  async function handleUpdateLevel(name: string, field: "discount"|"threshold", value: number) {
    const lv = levels.find(l => l.name === name);
    if (!lv) return;
    const newDisc = field === "discount" ? value : lv.discount;
    const newThr = field === "threshold" ? value : lv.threshold;
    try {
      await updateLevel(name, newDisc, newThr);
      onReload();
      setToast("已更新");
    } catch (e) { setToast("更新失败: "+e); }
  }

  async function handleExport() {
    try {
      const json = await exportAllData();
      const blob = new Blob([json], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `xiaofeng-backup-${new Date().toISOString().slice(0,10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      setToast("数据已导出");
    } catch (e) { setToast("导出失败: "+e); }
  }

  async function handleClear() {
    if (!confirm("⚠️ 警告：将清空所有会员和消费记录！\n\n此操作不可恢复，请先备份。")) return;
    if (!confirm("再次确认：真的要清空所有数据吗？")) return;
    try {
      await clearAllData();
      onReload();
      setToast("数据已清空");
    } catch (e) { setToast("清空失败: "+e); }
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
      // 自动映射，并处理列名含空白字符的情况
      const cleanCols = cols.map(c => c.trim().replace(/\s+/g, ''));
      const findCol = (patterns: string[], fallbackIndex?: number) => {
        const match = cols.find((c, i) => patterns.some(p => cleanCols[i].includes(p)));
        if (match) return match;
        if (fallbackIndex !== undefined && cols[fallbackIndex]) return cols[fallbackIndex];
        return "";
      };
      setImportMapping({
        name: findCol(["姓名", "name"], 0),
        phone: findCol(["手机", "电话", "phone"], 1),
        level: findCol(["等级", "级别", "level"]),
        balance: findCol(["余额"]),
        note: findCol(["备注", "note", "说明"], 5),
        totalSpent: findCol(["储值", "充值"]),
      });
      setImportStep("mapping");
    };
    reader.readAsArrayBuffer(file);
  }

  function previewImport() {
    const preview = importData.map((r: any) => {
      const bal = parseFloat(r[importMapping.balance]) || 0;
      const stored = parseFloat(r[importMapping.totalSpent]) || 0;
      const totalSpent = stored > 0 ? Math.max(0, stored - bal) : 0;
      return {
        name: String(r[importMapping.name]||"").trim(),
        phone: String(r[importMapping.phone]||"").trim(),
        level: String(r[importMapping.level]||"普通").trim() || "普通",
        balance: bal,
        note: String(r[importMapping.note]||"").trim(),
        total_spent: totalSpent,
      };
    }).filter((m: any) => m.name && m.phone);
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
      <h2>⚙️ 系统设置</h2>

      <div className="settings-section">
        <h3>会员等级折扣</h3>
        <p className="section-desc">根据会员累计消费金额自动升级，享受对应折扣</p>
        <table className="table">
          <thead><tr><th>等级</th><th>折扣率</th><th>升级门槛（累计消费）</th></tr></thead>
          <tbody>
            {levels.map(lv => (
              <tr key={lv.name}>
                <td><span className={`level-tag level-${lv.name}`}>{lv.name}</span></td>
                <td>
                  <input className="input input-sm" type="number" step="0.01" min="0" max="1"
                    value={lv.discount}
                    onChange={e => handleUpdateLevel(lv.name, "discount", parseFloat(e.target.value)||0)}
                    style={{width: 100}} />
                  <span style={{marginLeft: 4}}>（{(lv.discount*100).toFixed(0)}%）</span>
                </td>
                <td>
                  <input className="input input-sm" type="number" min="0"
                    value={lv.threshold}
                    onChange={e => handleUpdateLevel(lv.name, "threshold", parseFloat(e.target.value)||0)}
                    style={{width: 100}} />
                  <span style={{marginLeft: 4}}>元</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="settings-section">
        <h3>数据管理</h3>
        <div className="settings-actions">
          <button className="btn btn-outline" onClick={() => { setShowImport(true); setImportStep("upload"); }}>📥 导入Excel</button>
          <button className="btn btn-primary" onClick={handleExport}>📤 导出备份</button>
          <button className="btn btn-danger" onClick={handleClear}>🗑 清空数据</button>
        </div>
        <p className="hint">导入：支持 .xlsx/.xls 文件，首次使用时可批量导入会员。备份为 JSON 格式，清空前请先备份。</p>
      </div>

      {/* Excel 导入弹窗 */}
      {showImport && (
        <div className="modal-overlay" onClick={() => setShowImport(false)}>
          <div className="modal modal-lg" onClick={e => e.stopPropagation()}>
            <h3>📥 导入会员</h3>
            {importStep === "upload" && (
              <div>
                <p>请选择 .xlsx 或 .xls 文件，将自动识别列名</p>
                <input type="file" accept=".xlsx,.xls" onChange={handleFile} />
              </div>
            )}
            {importStep === "mapping" && (
              <div>
                <p>请确认列映射：</p>
                {(["name","phone","level","balance","note","totalSpent"] as const).map(f => (
                  <div key={f} className="form-row">
                    <label>{f==="name"?"姓名":f==="phone"?"手机号":f==="level"?"等级":f==="balance"?"余额":f==="note"?"备注":"储值金额"}</label>
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
                <table className="table"><thead><tr><th>姓名</th><th>手机号</th><th>等级</th><th>余额</th><th>累计消费</th></tr></thead>
                  <tbody>{importPreview.slice(0,10).map((m:any,i:number) => (
                    <tr key={i}><td>{m.name}</td><td>{m.phone}</td><td>{m.level}</td><td>¥{m.balance}</td><td>¥{(m.total_spent||0).toFixed(2)}</td></tr>
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
