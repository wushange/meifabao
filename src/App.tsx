import { useState, useEffect } from "react";
import type { ReactNode } from "react";
import { check } from "@tauri-apps/plugin-updater";
import { relaunch } from "@tauri-apps/plugin-process";
import { useAppData } from "./hooks/useAppData";
import { useAppVersion } from "./hooks/useAppVersion";
import { dailyBackup } from "./db";
import { ReceiptIcon, UsersIcon, ListIcon, ScissorsIcon, ChartIcon, GearIcon, ImportIcon } from "./components/Icons";
import logo from "./assets/logo.png";
import CheckoutPage from "./pages/CheckoutPage";
import MemberPage from "./pages/MemberPage";
import RecordPage from "./pages/RecordPage";
import ServicePage from "./pages/ServicePage";
import StatsPage from "./pages/StatsPage";
import SettingsPage from "./pages/SettingsPage";

type Tab = "checkout" | "members" | "records" | "services" | "stats" | "settings";

const tabs: { id: Tab; icon: ReactNode; label: string }[] = [
  { id: "checkout", icon: <ReceiptIcon />, label: "收银" },
  { id: "members", icon: <UsersIcon />, label: "会员" },
  { id: "records", icon: <ListIcon />, label: "记录" },
  { id: "services", icon: <ScissorsIcon />, label: "服务" },
  { id: "stats", icon: <ChartIcon />, label: "统计" },
  { id: "settings", icon: <GearIcon />, label: "设置" },
];

export default function App() {
  const [activeTab, setActiveTab] = useState<Tab>("checkout");
  const [toast, setToast] = useState("");
  const [updateModal, setUpdateModal] = useState<{ version: string; error: string } | null>(null);
  const [updating, setUpdating] = useState(false);
  const data = useAppData();
  const version = useAppVersion();

  // 顶部提示，4 秒自动消失
  useEffect(() => {
    if (toast) { const t = setTimeout(() => setToast(""), 4000); return () => clearTimeout(t); }
  }, [toast]);

  // 每日自动备份：启动时立即检查 + 每分钟轮询一次
  // （用户通常不关应用，仅启动时备份无法覆盖常开场景）
  useEffect(() => {
    if (data.loading) return;
    const run = () => {
      dailyBackup()
        .then(r => { if (r.backed_up) setToast(r.message); })
        .catch(e => setToast("自动备份失败：" + e));
    };
    run();
    const timer = setInterval(run, 60 * 1000);
    return () => clearInterval(timer);
  }, [data.loading]);

  // 启动时检查更新（OTA）
  useEffect(() => {
    if (data.loading) return;
    checkForUpdate();
  }, [data.loading]);

  async function checkForUpdate(manual = false) {
    try {
      const update = await check();
      if (update) setUpdateModal({ version: update.version, error: "" });
      else if (manual) setToast("已是最新版本");
    } catch (e) {
      if (manual) setToast("检查更新失败：" + e);
    }
  }

  async function doUpdate() {
    setUpdating(true);
    try {
      const update = await check();
      if (!update) { setUpdateModal(null); return; }
      await update.downloadAndInstall();
      await relaunch();
    } catch (e) {
      setUpdateModal(m => (m ? { ...m, error: String(e) } : m));
      setUpdating(false);
    }
  }

  if (data.loading) {
    return (
      <div className="app-loading">
        <div className="loading-logo"><img src={logo} alt="logo" style={{width:64,height:64,borderRadius:14,objectFit:"cover"}} /></div>
        <h1>小凤美发</h1>
        <p>加载中...</p>
      </div>
    );
  }

  if (data.error) {
    return (
      <div className="app-loading">
        <h2>⚠️ 加载失败</h2>
        <p>{data.error}</p>
        <button className="btn btn-primary" onClick={data.reload}>重试</button>
      </div>
    );
  }

  return (
    <div className="app">
      {toast && <div className="toast">{toast}</div>}
      {updateModal && (
        <div className="modal-overlay">
          <div className="modal">
            <h3 style={{display:"flex",alignItems:"center",gap:8}}><ImportIcon size={18} /> 发现新版本</h3>
            <p>发现新版本 v{updateModal.version}，是否立即下载更新？</p>
            {updateModal.error && <div className="form-error">更新失败：{updateModal.error}</div>}
            <div className="modal-actions">
              <button className="btn" onClick={() => setUpdateModal(null)} disabled={updating}>稍后</button>
              <button className="btn btn-primary" onClick={doUpdate} disabled={updating}>{updating ? "更新中..." : "立即更新"}</button>
            </div>
          </div>
        </div>
      )}
      {/* 侧边栏 */}
      <aside className="sidebar">
        <div className="sidebar-brand">
          <div className="sidebar-logo" style={{overflow:"hidden"}}><img src={logo} alt="logo" style={{width:"100%",height:"100%",objectFit:"cover"}} /></div>
          <div>
            <div className="sidebar-title">小凤美发</div>
            <div className="sidebar-subtitle">会员管理系统</div>
          </div>
        </div>
        <nav className="sidebar-nav">
          {tabs.map(tab => (
            <button
              key={tab.id}
              className={`sidebar-item${activeTab === tab.id ? " active" : ""}`}
              onClick={() => setActiveTab(tab.id)}
            >
              <span className="sidebar-item-icon">{tab.icon}</span>
              <span>{tab.label}</span>
            </button>
          ))}
        </nav>
        <div className="sidebar-footer">
          <span className="version">{version && `v${version}`}</span>
        </div>
      </aside>

      {/* 主内容：所有页面始终渲染，通过 display 切换保留状态 */}
      <main className="main-content">
        <div style={{display: activeTab === "checkout" ? "block" : "none"}}>
          <CheckoutPage records={data.records} onReload={data.reload} />
        </div>
        <div style={{display: activeTab === "members" ? "block" : "none"}}>
          <MemberPage members={data.members} onReload={data.reload} />
        </div>
        <div style={{display: activeTab === "records" ? "block" : "none"}}>
          <RecordPage
            records={data.records}
            recharges={data.recharges}
            members={data.members}
            onReload={data.reload}
          />
        </div>
        <div style={{display: activeTab === "services" ? "block" : "none"}}>
          <ServicePage services={data.services} onReload={data.reload} />
        </div>
        <div style={{display: activeTab === "stats" ? "block" : "none"}}>
          <StatsPage
            members={data.members}
            records={data.records}
            recharges={data.recharges}
          />
        </div>
        <div style={{display: activeTab === "settings" ? "block" : "none"}}>
          <SettingsPage onReload={data.reload} onCheckUpdate={() => checkForUpdate(true)} />
        </div>
      </main>
    </div>
  );
}
