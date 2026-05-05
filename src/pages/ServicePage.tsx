import { useState } from "react";
import { ServiceItem, addService, updateService, deleteService } from "../db";

interface Props {
  services: ServiceItem[];
  onReload: () => void;
}

export default function ServicePage({ services, onReload }: Props) {
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<ServiceItem | null>(null);
  const [name, setName] = useState("");
  const [price, setPrice] = useState("");
  const [category, setCategory] = useState("基础");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [toast, setToast] = useState("");

  const categories = [...new Set(services.map(s => s.category))];

  function openAdd() {
    setEditing(null); setName(""); setPrice(""); setCategory("基础"); setError(""); setShowForm(true);
  }
  function openEdit(s: ServiceItem) {
    setEditing(s); setName(s.name); setPrice(String(s.price)); setCategory(s.category); setError(""); setShowForm(true);
  }

  async function save() {
    if (!name.trim()) { setError("请输入服务名称"); return; }
    const p = parseFloat(price);
    if (isNaN(p) || p <= 0) { setError("请输入有效价格"); return; }
    setSubmitting(true);
    try {
      if (editing) {
        await updateService(editing.id, name.trim(), p, category);
      } else {
        await addService(name.trim(), p, category);
      }
      setShowForm(false); onReload();
    } catch (e: any) { setError(String(e)); }
    finally { setSubmitting(false); }
  }

  async function doDelete(s: ServiceItem) {
    if (!confirm(`确定删除「${s.name}」吗？`)) return;
    try { await deleteService(s.id); onReload(); } catch (e) { setToast("删除失败: "+e); }
  }

  return (
    <div className="page">
      {toast && <div className="toast" onClick={() => setToast("")}>{toast}</div>}
      <div className="page-header">
        <h2>✂️ 服务管理</h2>
        <button className="btn btn-primary" onClick={openAdd}>+ 新增服务</button>
      </div>

      {categories.map(cat => (
        <div key={cat} className="service-cat-section">
          <h3 className="service-cat-title">{cat}</h3>
          <div className="service-grid service-cards-grid">
            {services.filter(s => s.category === cat).map(s => (
              <div key={s.id} className="service-card">
                <div className="service-card-name">{s.name}</div>
                <div className="service-card-price">¥{s.price}</div>
                <div className="service-card-actions">
                  <button className="btn btn-sm btn-outline" onClick={() => openEdit(s)}>编辑</button>
                  <button className="btn btn-sm btn-danger" onClick={() => doDelete(s)}>删除</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}

      {showForm && (
        <div className="modal-overlay" onClick={() => setShowForm(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h3>{editing ? "编辑服务" : "新增服务"}</h3>
            {error && <div className="form-error">{error}</div>}
            <label>名称</label>
            <input className="input" value={name} onChange={e => setName(e.target.value)} />
            <label>价格</label>
            <input className="input" type="number" value={price} onChange={e => setPrice(e.target.value)} />
            <label>分类</label>
            <select className="input" value={category} onChange={e => setCategory(e.target.value)}>
              {categories.map(c => <option key={c}>{c}</option>)}
              {!categories.includes(category) && <option>{category}</option>}
            </select>
            <div className="modal-actions">
              <button className="btn" onClick={() => setShowForm(false)}>取消</button>
              <button className="btn btn-primary" onClick={save} disabled={submitting}>{submitting?"保存中...":"保存"}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
