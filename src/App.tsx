import { useState } from "react";
import { useAppData } from "./hooks/useAppData";
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
          <span className="sidebar-logo">💈</span>
          <span className="sidebar-title">小凤美发</span>
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

      {/* 主内容 */}
      <main className="main-content">
        {activeTab === "checkout" && (
          <CheckoutPage levels={data.levels} onReload={data.reload} />
        )}
        {activeTab === "members" && (
          <MemberPage members={data.members} onReload={data.reload} />
        )}
        {activeTab === "records" && (
          <RecordPage
            records={data.records}
            recharges={data.recharges}
            members={data.members}
            onReload={data.reload}
          />
        )}
        {activeTab === "services" && (
          <ServicePage services={data.services} onReload={data.reload} />
        )}
        {activeTab === "stats" && (
          <StatsPage
            members={data.members}
            records={data.records}
            recharges={data.recharges}
          />
        )}
        {activeTab === "settings" && (
          <SettingsPage levels={data.levels} onReload={data.reload} />
        )}
      </main>
    </div>
  );
}
