import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { getSetting, setSetting } from "../db";

interface Props {
  onActivated: () => void;
}

export default function ActivationScreen({ onActivated }: Props) {
  const [machineId, setMachineId] = useState("");
  const [licenseKey, setLicenseKey] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    invoke<string>("get_machine_id").then(setMachineId).catch(() => {});
  }, []);

  async function handleActivate() {
    if (!licenseKey.trim()) return;
    setLoading(true);
    setError("");
    try {
      const valid = await invoke<boolean>("verify_license", {
        machineId,
        licenseKey: licenseKey.trim(),
      });
      if (valid) {
        await setSetting("license_key", licenseKey.trim());
        onActivated();
      } else {
        setError("激活码无效，请检查机器码和激活码是否匹配");
      }
    } catch {
      setError("验证失败，请重试");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="activation-overlay">
      <div className="activation-card">
        <div className="activation-logo">💈</div>
        <h2>美发会员管理系统</h2>
        <p className="activation-desc">请输入激活码以继续使用</p>

        <div className="activation-field">
          <label>本机机器码</label>
          <div className="activation-machine-id">
            <code>{machineId || "加载中..."}</code>
            <button
              className="btn btn-sm btn-outline"
              onClick={() => {
                navigator.clipboard.writeText(machineId);
              }}
            >
              复制
            </button>
          </div>
        </div>

        <div className="activation-field">
          <label>激活码</label>
          <input
            className="input input-lg"
            placeholder="请输入卖家提供的 12 位激活码"
            value={licenseKey}
            onChange={e => setLicenseKey(e.target.value.toUpperCase())}
            onKeyDown={e => e.key === "Enter" && handleActivate()}
            maxLength={12}
            autoFocus
          />
        </div>

        {error && <div className="activation-error">{error}</div>}

        <button
          className="btn btn-primary btn-lg btn-block"
          onClick={handleActivate}
          disabled={loading || licenseKey.length < 12}
        >
          {loading ? "验证中..." : "🔑 激活"}
        </button>

        <p className="activation-hint">
          将机器码发送给卖家获取激活码，一机一码永久有效
        </p>
      </div>
    </div>
  );
}
