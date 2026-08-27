import { useState, useEffect } from "react";
import * as XLSX from "xlsx";
import {
  exportAllData, clearAllData, batchImportMembers,
  BackupConfig, getBackupConfig, saveBackupConfig, manualBackup,
  listBackups, revealBackup, BackupFileInfo,
} from "../db";
import CustomSelect from "../components/CustomSelect";
import { GearIcon, FolderIcon, SpeakerIcon, PaletteIcon, ImportIcon, ExportIcon, TrashIcon, SaveIcon, AlertIcon } from "../components/Icons";
import { useAppVersion } from "../hooks/useAppVersion";

interface Props {
  onReload: () => void;
  onCheckUpdate: () => void;
}

function VoiceToggle() {
  const [enabled, setEnabled] = useState(() => localStorage.getItem("voice_enabled") !== "0");
  function toggle() {
    const next = !enabled;
    setEnabled(next);
    localStorage.setItem("voice_enabled", next ? "1" : "0");
  }
  return (
    <label style={{display:"flex",alignItems:"center",gap:10,cursor:"pointer",userSelect:"none"}} onClick={toggle}>
      <div style={{width:44,height:24,borderRadius:12,background:enabled?"var(--success)":"#ccc",position:"relative",transition:"background .2s"}}>
        <div style={{width:20,height:20,borderRadius:"50%",background:"#fff",position:"absolute",top:2,left:enabled?22:2,transition:"left .2s"}} />
      </div>
      <span>{enabled ? "已开启" : "已关闭"}</span>
    </label>
  );
}

const THEMES: Record<string, Record<string, string>> = {
  "深蓝灰白": { "--gold":"#2563eb","--gold-light":"#dbeafe","--gold-lighter":"#eff6ff","--gold-dark":"#1d4ed8","--gold-gradient":"linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)","--bg":"#F4F6FB","--sidebar-bg":"#0f172a","--sidebar-active":"rgba(37,99,235,.18)","--border":"#e2e6ef","--border-light":"#eef0f6","--text":"#1e293b","--text-secondary":"#64748b","--text-tertiary":"#94a3b8" },
  暖金: { "--gold":"#c9952a","--gold-light":"#f7edd8","--gold-lighter":"#fdf6eb","--gold-dark":"#a87720","--gold-gradient":"linear-gradient(135deg, #d4a843 0%, #c9952a 100%)","--bg":"#f4f6f9","--sidebar-bg":"#1e1810","--sidebar-active":"rgba(201,149,42,.18)","--border":"#e8e0d0","--border-light":"#f0ece4","--text":"#2d2416","--text-secondary":"#8a7a68","--text-tertiary":"#b8a898" },
  翠绿: { "--gold":"#16a34a","--gold-light":"#dcfce7","--gold-lighter":"#f0fdf4","--gold-dark":"#15803d","--gold-gradient":"linear-gradient(135deg, #22c55e 0%, #16a34a 100%)","--bg":"#f4f9f4","--sidebar-bg":"#0f1a12","--sidebar-active":"rgba(22,163,74,.18)","--border":"#d0e8d8","--border-light":"#e8f4ec","--text":"#1c2e22","--text-secondary":"#5a7a62","--text-tertiary":"#8a9e8e" },
  玫红: { "--gold":"#db2777","--gold-light":"#fce7f3","--gold-lighter":"#fdf2f8","--gold-dark":"#be185d","--gold-gradient":"linear-gradient(135deg, #ec4899 0%, #db2777 100%)","--bg":"#fdf5f8","--sidebar-bg":"#1a1018","--sidebar-active":"rgba(219,39,119,.18)","--border":"#e8d0d8","--border-light":"#f4e8ec","--text":"#2e1c28","--text-secondary":"#8a6a7a","--text-tertiary":"#b89aaa" },
};

function ThemePicker() {
  const [theme, setTheme] = useState(() => localStorage.getItem("theme") || "深蓝灰白");
  useEffect(() => {
    const vars = THEMES[theme] || THEMES["深蓝灰白"];
    Object.entries(vars).forEach(([k, v]) => document.documentElement.style.setProperty(k, v));
    localStorage.setItem("theme", theme);
  }, [theme]);
  return (
    <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
      {Object.keys(THEMES).map(name => (
        <button key={name} className={`btn btn-sm ${theme===name?"btn-primary":"btn-outline"}`}
          onClick={() => setTheme(name)}>{name}</button>
      ))}
    </div>
  );
}

export default function SettingsPage({ onReload, onCheckUpdate }: Props) {
  const version = useAppVersion();
  const [toast, setToast] = useState("");
  const [showClearConfirm, setShowClearConfirm] = useState(false);

  // 备份配置
  const [backupConfig, setBackupConfig] = useState<BackupConfig>({ backup_dir: "", backup_keep_days: 30, backup_hour: 2 });
  const [backupSaving, setBackupSaving] = useState(false);
  const [backupRunning, setBackupRunning] = useState(false);
  const [backupFiles, setBackupFiles] = useState<BackupFileInfo[]>([]);

  async function loadBackups() {
    try { setBackupFiles(await listBackups()); } catch {}
  }

  function formatSize(bytes: number) {
    if (bytes < 1024) return bytes + " B";
    return (bytes / 1024).toFixed(1) + " KB";
  }

  async function doReveal(path: string) {
    try { await revealBackup(path); } catch (e) { setToast("无法打开文件目录: " + e); }
  }

  useEffect(() => { if (toast) { const t = setTimeout(() => setToast(""), 3000); return () => clearTimeout(t); } }, [toast]);
  useEffect(() => {
    getBackupConfig().then(setBackupConfig).catch(() => {});
  }, []);
  // 加载备份文件列表，每 30 秒刷新（应用常开时也能看到新备份）
  useEffect(() => {
    loadBackups();
    const t = setInterval(loadBackups, 30000);
    return () => clearInterval(t);
  }, []);

  async function handleSaveBackupConfig() {
    setBackupSaving(true);
    try {
      await saveBackupConfig(backupConfig);
      setToast("备份配置已保存");
      loadBackups();
    } catch (e) { setToast("保存失败: " + e); }
    finally { setBackupSaving(false); }
  }

  async function handleManualBackup() {
    setBackupRunning(true);
    try {
      const r = await manualBackup();
      setToast(r.message);
      loadBackups();
    } catch (e) { setToast("备份失败: " + e); }
    finally { setBackupRunning(false); }
  }

  // Excel 导入状态
  const [showImport, setShowImport] = useState(false);
  const [importStep, setImportStep] = useState<"upload"|"mapping"|"preview"|"result">("upload");
  const [importData, setImportData] = useState<any[]>([]);
  const [detectedCols, setDetectedCols] = useState<string[]>([]);
  const [importMapping, setImportMapping] = useState({name:"",phone:"",level:"",balance:"",note:"",totalSpent:""});
  const [importPreview, setImportPreview] = useState<any[]>([]);
  const [importResult, setImportResult] = useState<{ok:number;skip:number}|null>(null);

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
    setShowClearConfirm(true);
  }

  async function doClear() {
    try {
      await clearAllData();
      setShowClearConfirm(false);
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
      const ws = wb.Sheets[wb.SheetNames[0]];
      // 用header:1取原始表头（包含空值列，regular mode会跳过整列空的列）
      const allRows = XLSX.utils.sheet_to_json(ws, {header: 1});
      const cols = ((allRows[0] || []) as any[]).map((c: any) => String(c ?? ""));
      // 数据行仍用默认模式（跳过空值列）
      const rows = XLSX.utils.sheet_to_json(ws);
      setImportData(rows);
      setDetectedCols(cols);
      // 显示原始列名供用户参考
      const cleanCols = cols.map(c => c.trim().replace(/\s+/g, ''));
      // 更激进匹配: 包含任一关键词即可
      const findCol = (patterns: string[], fallbackIndex?: number) => {
        // 1. 精确关键词匹配
        for (const p of patterns) {
          const idx = cleanCols.findIndex(c => c.includes(p));
          if (idx >= 0) return cols[idx];
        }
        // 2. 首字匹配（如"备"匹配"备注"）
        for (const p of patterns) {
          if (p.length <= 1) continue;
          const firstChar = p[0];
          const idx = cleanCols.findIndex(c => c.includes(firstChar) && !["姓","电","等","储","余","name","phone","level","余额","储值"].some(x => c.includes(x)));
          if (idx >= 0 && !["姓名","电话","等级","储值金额","余额"].some(x => cols[idx]?.includes(x))) return cols[idx];
        }
        // 3. 位置兜底
        if (fallbackIndex !== undefined && cols[fallbackIndex]) return cols[fallbackIndex];
        return "";
      };
      setImportMapping({
        name: findCol(["姓名", "name"], 0),
        phone: findCol(["手机", "电话", "phone"], 1),
        level: findCol(["等级", "级别", "level"]),
        balance: findCol(["余额"]),
        note: findCol(["备注", "note", "说明", "备", "注"]),
        totalSpent: findCol(["累计消费", "总消费", "储值", "充值"]),
      });
      setImportStep("mapping");
    };
    reader.readAsArrayBuffer(file);
  }

  function previewImport() {
    const preview = importData.map((r: any) => {
      const bal = parseFloat(r[importMapping.balance]) || 0;
      const stored = parseFloat(r[importMapping.totalSpent]) || 0;
      return {
        name: String(r[importMapping.name]||"").trim(),
        phone: String(r[importMapping.phone]||"").trim(),
        level: String(r[importMapping.level]||"普通").trim() || "普通",
        balance: bal,
        note: String(r[importMapping.note]||"").trim(),
        total_spent: stored,
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
      <div className="page-header">
        <h2><GearIcon size={20} /> 系统设置</h2>
      </div>

      <div className="settings-section">
        <h3>数据管理</h3>
        <p className="section-desc">导入、导出或清空所有数据</p>
        <div className="settings-actions">
          <button className="btn btn-outline" onClick={() => { setShowImport(true); setImportStep("upload"); }}><ImportIcon size={15} /> 导入 Excel</button>
          <button className="btn btn-primary" onClick={handleExport}><ExportIcon size={15} /> 导出备份</button>
          <button className="btn btn-danger" onClick={handleClear}><TrashIcon size={15} /> 清空数据</button>
        </div>
        <p className="hint">导入：支持 .xlsx/.xls 文件，首次使用时可批量导入会员。备份为 JSON 格式，清空前请先备份。</p>
      </div>

      {/* Excel 导入弹窗 */}
      {showImport && (
        <div className="modal-overlay" onClick={() => setShowImport(false)}>
          <div className="modal modal-lg" onClick={e => e.stopPropagation()}>
            <h3 style={{display:"flex",alignItems:"center",gap:8}}><ImportIcon size={18} /> 导入会员</h3>
            {importStep === "upload" && (
              <div>
                <p>请选择 .xlsx 或 .xls 文件，将自动识别列名</p>
                <input type="file" accept=".xlsx,.xls" onChange={handleFile} />
              </div>
            )}
            {importStep === "mapping" && (
              <div>
                <p>请确认列映射（检测到列：{detectedCols.join(" | ") || "无"}）：</p>
                {(["name","phone","level","balance","note","totalSpent"] as const).map(f => (
                  <div key={f} className="form-row">
                    <label>{f==="name"?"姓名":f==="phone"?"手机号":f==="level"?"等级":f==="balance"?"余额":f==="note"?"备注":"储值金额"}</label>
                    <CustomSelect
                      value={importMapping[f]}
                      onChange={v => setImportMapping({...importMapping, [f]: v})}
                      options={[{ value: "", label: "不映射" }, ...Object.keys(importData[0]||{}).map(col => ({ value: col, label: col }))]}
                    />
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
                <p>导入完成！成功 {importResult.ok} 条，跳过 {importResult.skip} 条（重复）</p>
                <button className="btn btn-primary" onClick={() => setShowImport(false)}>关闭</button>
              </div>
            )}
          </div>
        </div>
      )}

      <div className="settings-section">
        <h3 style={{display:"flex",alignItems:"center",gap:8}}><FolderIcon size={16} /> 自动备份</h3>
        <p className="section-desc">每次启动应用时自动检查并备份会员数据为 .xlsx 文件</p>

        <div className="backup-config">
          <div className="backup-config-row">
            <label>备份文件夹</label>
            <div style={{flex:1,display:"flex",gap:8}}>
              <input
                className="input"
                placeholder="留空则使用默认路径（应用数据目录/backups）"
                value={backupConfig.backup_dir}
                onChange={e => setBackupConfig({...backupConfig, backup_dir: e.target.value})}
              />
            </div>
          </div>
          <div className="backup-config-row">
            <label>保留天数</label>
            <div style={{display:"flex",alignItems:"center",gap:8}}>
              <input
                className="input input-sm"
                type="number" min={1} max={365}
                value={backupConfig.backup_keep_days}
                onChange={e => setBackupConfig({...backupConfig, backup_keep_days: parseInt(e.target.value)||30})}
                style={{width:80}}
              />
              <span style={{color:"var(--text-secondary)",fontSize:"var(--font-size-sm)"}}>天（超出后自动删除最旧备份）</span>
            </div>
          </div>
          <div className="backup-config-row">
            <label>备份时间</label>
            <div style={{display:"flex",alignItems:"center",gap:8}}>
              <input
                className="input input-sm"
                type="number" min={0} max={23}
                value={backupConfig.backup_hour}
                onChange={e => setBackupConfig({...backupConfig, backup_hour: parseInt(e.target.value)||0})}
                style={{width:80}}
              />
              <span style={{color:"var(--text-secondary)",fontSize:"var(--font-size-sm)"}}>时（每天该时间点后首次启动才执行备份）</span>
            </div>
          </div>
        </div>

        <div className="settings-actions" style={{marginTop:14}}>
          <button className="btn btn-primary" onClick={handleSaveBackupConfig} disabled={backupSaving}>
            {backupSaving ? "保存中..." : <><SaveIcon size={15} /> 保存配置</>}
          </button>
          <button className="btn btn-outline" onClick={handleManualBackup} disabled={backupRunning}>
            {backupRunning ? "备份中..." : <><FolderIcon size={15} /> 立即备份</>}
          </button>
        </div>

        {/* 已有备份列表 */}
        <div style={{marginTop:16}}>
          <div style={{display:"flex",alignItems:"center",gap:8,fontSize:"var(--font-size-sm)",fontWeight:600,color:"var(--text-secondary)",marginBottom:8}}>
            <FolderIcon size={15} /> 已有备份（{backupFiles.length}）
          </div>
          {backupFiles.length === 0 ? (
            <div className="empty-state" style={{padding:"16px 0",fontSize:"var(--font-size-sm)"}}>暂无备份文件</div>
          ) : (
            <div style={{border:"1px solid var(--border-light)",borderRadius:10,overflow:"hidden"}}>
              {backupFiles.map((f, i) => (
                <div
                  key={f.path}
                  onClick={() => doReveal(f.path)}
                  title="点击在文件管理器中定位"
                  onMouseEnter={e => { e.currentTarget.style.background = "var(--gold-lighter)"; }}
                  onMouseLeave={e => { e.currentTarget.style.background = "var(--card)"; }}
                  style={{
                    display:"flex",alignItems:"center",justifyContent:"space-between",gap:10,
                    padding:"9px 13px",
                    borderBottom: i < backupFiles.length - 1 ? "1px solid var(--border-light)" : "none",
                    cursor:"pointer",background:"var(--card)",fontSize:"var(--font-size-sm)",
                  }}
                >
                  <span style={{fontWeight:500,color:"var(--text)",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{f.name}</span>
                  <span style={{display:"flex",alignItems:"center",gap:12,flexShrink:0,color:"var(--text-secondary)"}}>
                    <span>{f.modified}</span>
                    <span style={{fontVariantNumeric:"tabular-nums"}}>{formatSize(f.size)}</span>
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        <p className="hint">备份格式为 .xlsx，每日备份如 backup_2026-08-27.xlsx，手动备份带时间戳。点击文件可在文件管理器中定位。</p>
      </div>

      <div className="settings-section">
        <h3 style={{display:"flex",alignItems:"center",gap:8}}><SpeakerIcon size={16} /> 语音播报</h3>
        <p className="section-desc">结账成功时语音播报，可自定义模板</p>
        <VoiceToggle />
        <div style={{marginTop:12}}>
          <label style={{fontSize:"var(--font-size-sm)",color:"var(--text-secondary)",display:"block",marginBottom:4}}>
            播报模板（{'{payment}'}={'支付方式'} {'{total}'}={'金额'} {'{balance}'}={'余额'}）
          </label>
          <input className="input"
            defaultValue={localStorage.getItem("voice_template") || "本次{payment}，消费{total}元，余额{balance}元，欢迎下次光临"}
            onBlur={e => localStorage.setItem("voice_template", e.target.value)}
            style={{width:"100%"}} />
        </div>
      </div>

      <div className="settings-section">
        <h3 style={{display:"flex",alignItems:"center",gap:8}}><PaletteIcon size={16} /> 主题配色</h3>
        <p className="section-desc">选择界面配色方案，即时生效</p>
        <ThemePicker />
      </div>

      <div className="settings-section" style={{textAlign:"center"}}>
        <div style={{display:"flex",justifyContent:"center",gap:10,alignItems:"center",marginBottom:8}}>
          <button className="btn btn-sm btn-outline" onClick={onCheckUpdate}>检查更新</button>
        </div>
        <p style={{fontSize:"var(--font-size-sm)",color:"var(--text-tertiary)"}}>小凤美发管理系统 · {version && `v${version}`}</p>
      </div>

      {/* 清空确认弹窗 */}
      {showClearConfirm && (
        <div className="modal-overlay" onClick={() => setShowClearConfirm(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h3 style={{display:"flex",alignItems:"center",gap:8}}><AlertIcon size={18} /> 确认清空数据</h3>
            <p style={{margin:"12px 0",color:"var(--danger)"}}>将清空所有会员和消费记录，此操作不可恢复！</p>
            <p style={{marginBottom:16,color:"var(--text-secondary)",fontSize:"var(--font-size-sm)"}}>建议先导出备份</p>
            <div className="modal-actions">
              <button className="btn" onClick={() => setShowClearConfirm(false)}>取消</button>
              <button className="btn btn-danger" onClick={doClear}>确认清空</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
