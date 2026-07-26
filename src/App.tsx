import { useState, useEffect } from "react";
import { useAppData } from "./hooks/useAppData";
import { dailyBackup } from "./db";
import CheckoutPage from "./pages/CheckoutPage";
import MemberPage from "./pages/MemberPage";
import RecordPage from "./pages/RecordPage";
import ServicePage from "./pages/ServicePage";
import StatsPage from "./pages/StatsPage";
import SettingsPage from "./pages/SettingsPage";

type Tab = "checkout" | "members" | "records" | "services" | "stats" | "settings";

const tabs: { id: Tab; icon: string; label: string }[] = [
  { id: "checkout", icon: "💰", label: "收银" },
  { id: "members", icon: "👥", label: "会员" },
  { id: "records", icon: "📋", label: "记录" },
  { id: "services", icon: "✂️", label: "服务" },
  { id: "stats", icon: "📊", label: "统计" },
  { id: "settings", icon: "⚙️", label: "设置" },
];

export default function App() {
  const [activeTab, setActiveTab] = useState<Tab>("checkout");
  const data = useAppData();

  // 启动时执行每日自动备份
  useEffect(() => {
    if (!data.loading && data.members.length >= 0) {
      dailyBackup().catch(() => {});
    }
  }, [data.loading]);

  if (data.loading) {
    return (
      <div className="app-loading">
        <div className="loading-logo">💈</div>
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
      {/* 侧边栏 */}
      <aside className="sidebar">
        <div className="sidebar-brand">
          <div className="sidebar-logo">💈</div>
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
          <span className="version">v0.1.0</span>
        </div>
      </aside>

      {/* 主内容：所有页面始终渲染，通过 display 切换保留状态 */}
      <main className="main-content">
        <div style={{display: activeTab === "checkout" ? "block" : "none"}}>
          <CheckoutPage onReload={data.reload} />
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
          <SettingsPage onReload={data.reload} />
        </div>
      </main>
    </div>
  );
}
