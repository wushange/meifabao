import { useState, useEffect } from "react";
import * as XLSX from "xlsx";
import { open } from "@tauri-apps/plugin-dialog";
import {
  LevelInfo, updateLevel, exportAllData, clearAllData, batchImportMembers,
  BackupConfig, getBackupConfig, saveBackupConfig, manualBackup,
  setSetting, getSetting,
} from "../db";

type FontSize = "small" | "normal" | "large";

interface Props {
  levels: LevelInfo[];
  storeName: string;
  fontSize: FontSize;
  onStoreNameChange: (name: string) => void;
  onFontSizeChange: (fs: FontSize) => void;
  onReload: () => void;
}

export default function SettingsPage({
  levels, storeName, fontSize,
  onStoreNameChange, onFontSizeChange, onReload,
}: Props) {
  const [localStoreName, setLocalStoreName] = useState(storeName);
  const [localFontSize, setLocalFontSize] = useState<FontSize>(fontSize);
  const [voiceEnabled, setVoiceEnabled] = useState(true);
  const [toast, setToast] = useState("");

  const [backupConfig, setBackupConfig] = useState<BackupConfig>({ backup_dir: "", backup_keep_days: 30, backup_hour: 2 });
  const [backupSaving, setBackupSaving] = useState(false);
  const [backupRunning, setBackupRunning] = useState(false);

  useEffect(() => {
    getBackupConfig().then(setBackupConfig).catch(() => {});
    getSetting("voice_enabled").then(v => setVoiceEnabled(v !== "0")).catch(() => {});
  }, []);

  async function handleSaveBackupConfig() {
    setBackupSaving(true);
    try {
      await saveBackupConfig(backupConfig);
      setToast("✅ 备份配置已保存");
    } catch (e) { setToast("保存失败: " + e); }
    finally { setBackupSaving(false); }
  }

  async function handleManualBackup() {
    setBackupRunning(true);
    try {
      const r = await manualBackup();
      setToast("✅ " + r.message);
    } catch (e) { setToast("备份失败: " + e); }
    finally { setBackupRunning(false); }
  }

  const [showImport, setShowImport] = useState(false);
  const [importStep, setImportStep] = useState<"upload"|"mapping"|"preview"|"result">("upload");
  const [importData, setImportData] = useState<any[]>([]);
  const [detectedCols, setDetectedCols] = useState<string[]>([]);
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
      a.download = "meifabao_export.json";
      a.click();
      URL.revokeObjectURL(url);
      setToast("✅ 数据导出完成");
    } catch (e) { setToast("导出失败: " + e); }
  }

  async function handleClearAll() {
    const ok = confirm("⚠️ 确定清空所有数据？此操作不可恢复！");
    if (!ok) return;
    try { await clearAllData(); onReload(); setToast("✅ 数据已清空"); }
    catch (e) { setToast("清空失败: " + e); }
  }

  function handleExcelUpload(file: File) {
    const reader = new FileReader();
    reader.onload = (e) => {
      const wb = XLSX.read(e.target!.result, { type: "array" });
      const sheet = wb.Sheets[wb.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json<any[]>(sheet, { header: 1 });
      if (rows.length < 2) { setToast("Excel 文件为空或格式不正确"); return; }
      const headers = rows[0].map((h: any) => String(h || ""));
      setDetectedCols(headers);
      setImportData(rows.slice(1));
      // 智能映射（支持常见表头变体）
      const map: any = { name: "", phone: "", level: "", balance: "", note: "", totalSpent: "" };
      for (let i = 0; i < headers.length; i++) {
        const h = headers[i].trim().toLowerCase().replace(/[：:]/g, "");
        if (!map.name && (h.includes("姓名") || h.includes("名字") || h === "name" || h.includes("会员名"))) map.name = i;
        if (!map.phone && (h.includes("电话") || h.includes("手机") || h === "phone" || h.includes("号码"))) map.phone = i;
        if (!map.level && (h.includes("等级") || h === "level" || h.includes("级别"))) map.level = i;
        if (!map.balance && (h.includes("余额") || h === "balance" || h.includes("储值"))) map.balance = i;
        if (!map.note && (h.includes("备注") || h === "note" || h.includes("说明"))) map.note = i;
        if (!map.totalSpent && (h.includes("累计") || h.includes("消费") || h === "total" || h.includes("总额"))) map.totalSpent = i;
      }
      setImportMapping(map);
      setImportStep("mapping");
    };
    reader.readAsArrayBuffer(file);
  }

  function applyMapping() {
    let skipped = 0;
    const preview = importData.map((r: any) => {
      const name = String(r[importMapping.name]||"").trim();
      const phone = String(r[importMapping.phone]||"").trim();
      if (!name || !phone) { skipped++; return null; }
      const bal = parseFloat(r[importMapping.balance]) || 0;
      const stored = parseFloat(r[importMapping.totalSpent]) || 0;
      const totalSpent = stored > 0 ? Math.max(0, stored - bal) : 0;
      return {
        name,
        phone,
        level: String(r[importMapping.level]||"").trim() || "普通",
        balance: bal,
        total_spent: totalSpent,
        note: String(r[importMapping.note]||"").trim(),
      };
    }).filter((m: any) => m !== null);
    if (skipped > 0) setToast(`⚠️ 已跳过 ${skipped} 行（姓名或手机号为空）`);
    setImportPreview(preview); setImportStep("preview");
  }

  async function doImport() {
    try {
      const [ok, skip] = await batchImportMembers(importPreview);
      setImportResult({ ok, skip }); setImportStep("result"); onReload();
    } catch (e) { setToast("导入失败: "+e); }
  }

  async function handleFontSizeChange(fs: FontSize) {
    setLocalFontSize(fs);
    try {
      await setSetting("font_size", fs);
      onFontSizeChange(fs);
      setToast("✅ 字体大小已应用");
    } catch (e) { setToast("保存失败: "+e); }
  }

  async function handleSaveStoreName() {
    if (!localStoreName.trim() || localStoreName === storeName) return;
    try {
      await setSetting("store_name", localStoreName.trim());
      onStoreNameChange(localStoreName.trim());
      setToast("✅ 店铺名称已保存");
    } catch (e) { setToast("保存失败: "+e); }
  }

  return (
    <div className="page">
      {toast && <div className="toast" onClick={() => setToast("")}>{toast}</div>}
      <div className="page-header">
        <h2>⚙️ 系统设置</h2>
      </div>

      {/* 店铺名称 */}
      <div className="settings-section">
        <h3>店铺名称</h3>
        <p className="section-desc">修改后侧边栏和标题栏的显示名称</p>
        <div style={{display:"flex",alignItems:"center",gap:10,marginTop:14}}>
          <input
            className="input"
            type="text"
            value={localStoreName}
            onChange={e => setLocalStoreName(e.target.value)}
            onKeyDown={e => e.key === "Enter" && handleSaveStoreName()}
            style={{maxWidth:300}}
            placeholder="例如：美发宝"
          />
          <button className="btn btn-primary btn-sm" onClick={handleSaveStoreName}
            disabled={!localStoreName.trim() || localStoreName === storeName}>
            💾 保存
          </button>
        </div>
      </div>

      {/* 字体大小 */}
      <div className="settings-section">
        <h3>字体大小</h3>
        <p className="section-desc">调整全局文字大小，适配不同屏幕和视力需求</p>
        <div style={{display:"flex",gap:10,marginTop:14}}>
          {(["small","normal","large"] as FontSize[]).map(fs => (
            <button
              key={fs}
              className={`btn ${localFontSize === fs ? "btn-primary" : "btn-outline"}`}
              onClick={() => handleFontSizeChange(fs)}
            >
              {fs === "small" ? "🔹 小" : fs === "normal" ? "🔸 中" : "🔶 大"}
            </button>
          ))}
        </div>
      </div>

      {/* 语音播报 */}
      <div className="settings-section">
        <h3>语音播报</h3>
        <p className="section-desc">结账后自动语音播报消费金额与余额</p>
        <div style={{marginTop:14}}>
          <label style={{display:"flex",alignItems:"center",gap:10,cursor:"pointer"}}>
            <input type="checkbox" checked={voiceEnabled}
              onChange={async e => {
                const v = e.target.checked;
                setVoiceEnabled(v);
                try { await setSetting("voice_enabled", v ? "1" : "0"); setToast(v ? "✅ 语音播报已开启" : "🔇 语音播报已关闭"); }
                catch { setVoiceEnabled(!v); }
              }}
              style={{width:18,height:18,cursor:"pointer"}} />
            <span>{voiceEnabled ? "🔊 已开启" : "🔇 已关闭"}</span>
          </label>
        </div>
      </div>

      <div className="settings-section">
        <h3>会员等级折扣</h3>
        <p className="section-desc">根据会员累计消费金额自动升级，享受对应折扣</p>
        <div className="table-wrap" style={{marginTop:14}}>
          <div className="table-scroll">
            <table className="table">
              <thead><tr><th>等级</th><th>折扣率</th><th>升级门槛（累计消费）</th></tr></thead>
              <tbody>
                {levels.map(lv => (
                  <tr key={lv.name}>
                    <td><span className={`level-tag level-${lv.name}`}>{lv.name}</span></td>
                    <td>
                      <div style={{display:"flex",alignItems:"center",gap:8}}>
                        <input className="input input-sm" type="number" step="0.01" min="0" max="1"
                          value={lv.discount}
                          onChange={e => handleUpdateLevel(lv.name, "discount", parseFloat(e.target.value)||0)}
                          style={{width:90}} />
                        <span style={{color:"var(--text-secondary)",fontSize:"var(--font-size-sm)"}}>（{(lv.discount*100).toFixed(0)}% 折）</span>
                      </div>
                    </td>
                    <td>
                      <div style={{display:"flex",alignItems:"center",gap:8}}>
                        <input className="input input-sm" type="number" min="0"
                          value={lv.threshold}
                          onChange={e => handleUpdateLevel(lv.name, "threshold", parseFloat(e.target.value)||0)}
                          style={{width:100}} />
                        <span style={{color:"var(--text-secondary)",fontSize:"var(--font-size-sm)"}}>元</span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <div className="settings-section">
        <h3>数据管理</h3>
        <div style={{display:"flex",gap:10,flexWrap:"wrap",marginTop:14}}>
          <button className="btn btn-outline" onClick={handleExport}>📥 导出所有数据</button>
          <button className="btn btn-outline" onClick={() => setShowImport(true)}>📤 导入 Excel 会员</button>
          <button className="btn btn-danger" onClick={handleClearAll}>🗑️ 清空所有数据</button>
        </div>
      </div>

      {/* Excel 导入弹窗 */}
      {showImport && (
        <div className="modal-mask" onClick={() => setShowImport(false)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{maxWidth:650,width:"90%"}}>
            <div className="modal-header">
              <h3>📤 导入会员</h3>
              <button className="btn-icon" onClick={() => setShowImport(false)}>✕</button>
            </div>

            {importStep === "upload" && (
              <div style={{padding:"20px 0",textAlign:"center"}}>
                <p style={{marginBottom:16}}>选择 Excel 文件（.xlsx），第一行为表头</p>
                <input type="file" accept=".xlsx,.xls" onChange={e => e.target.files?.[0] && handleExcelUpload(e.target.files[0])} />
              </div>
            )}

            {importStep === "mapping" && (
              <div>
                <p style={{marginBottom:12}}>请匹配列对应关系：</p>
                <div className="table-scroll" style={{maxHeight:200}}>
                  <table className="table">
                    <thead><tr>
                      {["姓名","手机号","等级","余额","备注","累计消费"].map(k => <th key={k}>{k}</th>)}
                    </tr></thead>
                    <tbody><tr>
                      {["name","phone","level","balance","note","totalSpent"].map(kf => (
                        <td key={kf}>
                          <select className="input input-sm" value={importMapping[kf]} onChange={e => setImportMapping({...importMapping, [kf]: e.target.value})}>
                            <option value="">-</option>
                            {detectedCols.map((c, i) => <option key={i} value={i}>{c}</option>)}
                          </select>
                        </td>
                      ))}
                    </tr></tbody>
                  </table>
                </div>
                <div style={{marginTop:14,display:"flex",gap:10,justifyContent:"flex-end"}}>
                  <button className="btn btn-outline" onClick={() => setImportStep("upload")}>返回</button>
                  <button className="btn btn-primary" onClick={applyMapping}>预览</button>
                </div>
              </div>
            )}

            {importStep === "preview" && (
              <div>
                <p style={{marginBottom:8}}>预览共 {importPreview.length} 条：</p>
                <div className="table-scroll" style={{maxHeight:260}}>
                  <table className="table">
                    <thead><tr><th>姓名</th><th>手机号</th><th>等级</th><th>余额</th></tr></thead>
                    <tbody>
                      {importPreview.slice(0,50).map((m: any,i: number) => (
                        <tr key={i}><td>{m.name}</td><td>{m.phone}</td><td>{m.level}</td><td>{m.balance}</td></tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div style={{marginTop:14,display:"flex",gap:10,justifyContent:"flex-end"}}>
                  <button className="btn btn-outline" onClick={() => setImportStep("upload")}>返回</button>
                  <button className="btn btn-primary" onClick={doImport}>确认导入</button>
                </div>
              </div>
            )}

            {importStep === "result" && importResult && (
              <div style={{textAlign:"center",padding:"30px 0"}}>
                <p style={{fontSize:40}}>✅</p>
                <p>成功导入 <strong>{importResult.ok}</strong> 条，跳过 <strong>{importResult.skip}</strong> 条（手机号重复）</p>
                <button className="btn btn-primary" style={{marginTop:16}} onClick={() => setShowImport(false)}>完成</button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 备份配置 */}
      <div className="settings-section">
        <h3>自动备份</h3>
        <p className="section-desc">每日自动备份会员数据为 Excel，防数据丢失</p>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"14px 28px",marginTop:14,maxWidth:520}}>
          <div>
            <label className="input-label">备份目录</label>
            <div style={{display:"flex",gap:8,alignItems:"center"}}>
              <input className="input" value={backupConfig.backup_dir || "默认目录"} readOnly
                style={{flex:1,background:"var(--bg)",cursor:"default"}} />
              <button className="btn btn-outline btn-sm" onClick={async () => {
                try {
                  const dir = await open({ directory: true, multiple: false, title: "选择备份目录" });
                  if (dir) setBackupConfig({...backupConfig, backup_dir: dir});
                } catch {}
              }}>📁 选择</button>
            </div>
            <span className="hint" style={{display:"block",marginTop:4}}>留空使用系统默认备份目录</span>
          </div>
          <div>
            <label className="input-label">保留天数</label>
            <input className="input" type="number" min={1} max={365} value={backupConfig.backup_keep_days}
              onChange={e => setBackupConfig({...backupConfig, backup_keep_days: parseInt(e.target.value)||30})} />
          </div>
          <div>
            <label className="input-label">自动备份时间</label>
            <select className="input" value={backupConfig.backup_hour}
              onChange={e => setBackupConfig({...backupConfig, backup_hour: parseInt(e.target.value)})}>
              {Array.from({length:24},(_,i)=>i).map(h => (
                <option key={h} value={h}>每天 {h}:00</option>
              ))}
            </select>
          </div>
        </div>
        <div style={{marginTop:14,display:"flex",gap:10}}>
          <button className="btn btn-primary" onClick={handleSaveBackupConfig} disabled={backupSaving}>
            {backupSaving ? "保存中..." : "💾 保存配置"}
          </button>
          <button className="btn btn-outline" onClick={handleManualBackup} disabled={backupRunning}>
            {backupRunning ? "备份中..." : "📦 立即备份"}
          </button>
        </div>
        <p className="hint">备份格式为 .xlsx，文件名格式：members_YYYY-MM-DD.xlsx。手动备份文件名会加时间戳。</p>
      </div>

      <div className="settings-section" style={{textAlign:"center",opacity:.6}}>
        <p style={{fontSize:"var(--font-size-sm)",color:"var(--text-tertiary)"}}>美发宝 · v0.1.0</p>
      </div>
    </div>
  );
}
