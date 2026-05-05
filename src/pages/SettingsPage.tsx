import { useState } from "react";
import { LevelInfo, updateLevel, exportAllData, clearAllData } from "../db";

interface Props {
  levels: LevelInfo[];
  onReload: () => void;
}

export default function SettingsPage({ levels, onReload }: Props) {
  const [toast, setToast] = useState("");

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
                  <input
                    className="input input-sm"
                    type="number"
                    step="0.01"
                    min="0"
                    max="1"
                    value={lv.discount}
                    onChange={e => handleUpdateLevel(lv.name, "discount", parseFloat(e.target.value)||0)}
                    style={{width: 100}}
                  />
                  <span style={{marginLeft: 4}}>（{(lv.discount*100).toFixed(0)}%）</span>
                </td>
                <td>
                  <input
                    className="input input-sm"
                    type="number"
                    min="0"
                    value={lv.threshold}
                    onChange={e => handleUpdateLevel(lv.name, "threshold", parseFloat(e.target.value)||0)}
                    style={{width: 100}}
                  />
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
          <button className="btn btn-primary" onClick={handleExport}>📤 导出备份</button>
          <button className="btn btn-danger" onClick={handleClear}>🗑 清空数据</button>
        </div>
        <p className="hint">备份文件为 JSON 格式，可用于数据迁移。清空数据前请先备份。</p>
      </div>
    </div>
  );
}
