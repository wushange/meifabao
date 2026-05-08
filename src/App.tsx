import { useState, useEffect } from "react";
import { useAppData } from "./hooks/useAppData";
import { dailyBackup, getSetting } from "./db";
import ActivationScreen from "./components/ActivationScreen";
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

type FontSize = "small" | "normal" | "large";

export default function App() {
  const [activeTab, setActiveTab] = useState<Tab>("checkout");
  const [storeName, setStoreName] = useState("美发宝");
  const [fontSize, setFontSize] = useState<FontSize>("normal");
  const [activated, setActivated] = useState(false);
  const [checkingActivation, setCheckingActivation] = useState(true);
  const data = useAppData();

  useEffect(() => {
    Promise.all([
      getSetting("store_name"),
      getSetting("font_size"),
      getSetting("license_key"),
    ]).then(([name, fs, lk]) => {
      if (name) setStoreName(name);
      if (fs === "small" || fs === "large") setFontSize(fs);
      setActivated(!!lk);
      setCheckingActivation(false);
    }).catch(() => setCheckingActivation(false));
  }, []);

  useEffect(() => {
    if (!data.loading && data.members.length >= 0) {
      dailyBackup().catch(() => {});
    }
  }, [data.loading]);

  if (checkingActivation) {
    return (
      <div className="app-loading font-normal">
        <div className="loading-logo">💈</div>
        <p>加载中...</p>
      </div>
    );
  }

  if (!activated) {
    return <ActivationScreen onActivated={() => setActivated(true)} />;
  }

  if (data.loading) {
    return (
      <div className={`app-loading font-${fontSize}`}>
        <div className="loading-logo">💈</div>
        <h1>{storeName}</h1>
        <p>加载中...</p>
      </div>
    );
  }

  if (data.error) {
    return (
      <div className={`app-loading font-${fontSize}`}>
        <h2>⚠️ 加载失败</h2>
        <p>{data.error}</p>
        <button className="btn btn-primary" onClick={data.reload}>重试</button>
      </div>
    );
  }

  return (
    <div className={`app font-${fontSize}`}>
      <aside className="sidebar">
        <div className="sidebar-brand">
          <div className="sidebar-logo">💈</div>
          <div>
            <div className="sidebar-title">{storeName}</div>
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

      <main className="main-content">
        {activeTab === "checkout" && (
          <CheckoutPage levels={data.levels} members={data.members} records={data.records} recharges={data.recharges} onReload={data.reload} />
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
          <SettingsPage
            levels={data.levels}
            storeName={storeName}
            fontSize={fontSize}
            onStoreNameChange={setStoreName}
            onFontSizeChange={setFontSize}
            onReload={data.reload}
          />
        )}
      </main>
    </div>
  );
}
