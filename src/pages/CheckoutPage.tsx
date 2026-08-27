import { useState, useMemo, useEffect, useRef } from "react";
import {
  searchMembers, getServices, checkout,
  MemberFull, ServiceItem, RecordItem, CheckoutReceipt,
} from "../db";
import { ReceiptIcon } from "../components/Icons";

interface Props {
  records: RecordItem[];
  onReload: () => void;
}

export default function CheckoutPage({ records, onReload }: Props) {
  const [keyword, setKeyword] = useState("");
  const [results, setResults] = useState<MemberFull[]>([]);
  const [searched, setSearched] = useState(false);
  const [searching, setSearching] = useState(false);
  const [selected, setSelected] = useState<MemberFull | null>(null);
  const [services, setServices] = useState<ServiceItem[]>([]);
  const [payment, setPayment] = useState("余额");
  const [note, setNote] = useState("");
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState("");
  const [receipt, setReceipt] = useState<CheckoutReceipt | null>(null);

  // 购物车：统一混合预设 + 自定义，id>0=预设服务，id<0=自定义
  type CartItem = { id: number; name: string; price: number };
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const customIdRef = useRef(0);

  const [customName, setCustomName] = useState("");
  const [customPrice, setCustomPrice] = useState("");

  function addCustomService() {
    if (!customName.trim()) return;
    const price = parseFloat(customPrice);
    if (isNaN(price) || price <= 0) return;
    const id = customIdRef.current - 1;
    customIdRef.current = id;
    setCartItems(prev => [...prev, { id, name: customName.trim(), price }]);
    setCustomName(""); setCustomPrice("");
  }

  function toggleCart(sid: number) {
    const svc = services.find(s => s.id === sid);
    if (!svc) return;
    setCartItems(prev => {
      const exists = prev.find(i => i.id === sid);
      return exists ? prev.filter(i => i.id !== sid) : [...prev, { id: sid, name: svc.name, price: svc.price }];
    });
  }

  // 输入自动搜索（300ms 防抖）
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!keyword.trim()) {
      setResults([]);
      setSearched(false);
      setSelected(null);
      setCartItems([]);
      return;
    }
    debounceRef.current = setTimeout(() => doSearch(), 300);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [keyword]);

  // toast 3秒自动消失
  useEffect(() => { if (toast) { const t = setTimeout(() => setToast(""), 3000); return () => clearTimeout(t); } }, [toast]);

  const total = cartItems.reduce((s, i) => s + i.price, 0);

  // 今日消费（默认展示）
  const today = new Date().toDateString();
  const todayRecords = useMemo(
    () => records.filter(r => new Date(r.created_at).toDateString() === today),
    [records, today]
  );
  const todayIncome = todayRecords.reduce((s, r) => s + r.amount, 0);

  async function doSearch() {
    if (!keyword.trim()) return;
    setSearching(true);
    setSearched(true);
    try {
      const r = await searchMembers(keyword.trim());
      setResults(r);
    } catch (e) { setToast("搜索失败: " + e); }
    finally { setSearching(false); }
  }

  async function selectMember(m: MemberFull) {
    setSelected(m);
    setCartItems([]);
    setNote("");
    try { setServices(await getServices()); } catch {}
  }

  async function doCheckout() {
    if (!selected || cartItems.length === 0) return;
    if (payment === "余额" && selected.balance < total) {
      setToast(`余额不足！当前 ¥${selected.balance.toFixed(2)}，需 ¥${total.toFixed(2)}`);
      return;
    }
    setLoading(true);
    try {
      const ids = cartItems.filter(i => i.id > 0).map(i => i.id);
      const customs = cartItems.filter(i => i.id < 0).map(i => ({ name: i.name, price: i.price }));
      const r = await checkout(selected.id, ids, customs, payment, note);
      setReceipt(r);
      setToast(`✅ 结账成功！实付 ¥${r.total.toFixed(2)}，余额 ¥${r.new_balance.toFixed(2)}`);
      if (localStorage.getItem("voice_enabled") !== "0") {
        const template = localStorage.getItem("voice_template")
          || "本次{payment}，消费{total}元，余额{balance}元，欢迎下次光临";
        const pm = payment === "现金" ? "现金支付" : payment === "微信" ? "微信支付" : "余额支付";
        const text = template
          .replace("{payment}", pm)
          .replace("{total}", r.total.toFixed(0))
          .replace("{balance}", r.new_balance.toFixed(0));
        const u = new SpeechSynthesisUtterance(text);
        u.lang = "zh-CN"; u.rate = 0.9;
        speechSynthesis.cancel();
        speechSynthesis.speak(u);
      }
      setSelected(null);
      setCartItems([]);
      setKeyword("");
      setResults([]);
      setSearched(false);
      onReload();
    } catch (e) { setToast("结账失败: " + e); }
    finally { setLoading(false); }
  }

  // 按分类分组服务
  const serviceGroups = useMemo(() => {
    const map: Record<string, ServiceItem[]> = {};
    for (const s of services) {
      (map[s.category] ??= []).push(s);
    }
    return map;
  }, [services]);

  if (receipt) {
    return (
      <div className="receipt-overlay" onClick={() => setReceipt(null)}>
        <div className="receipt-card" onClick={e => e.stopPropagation()}>
          <div className="receipt-title"><ReceiptIcon size={18} /> 消费小票</div>
          <div className="receipt-body">
            <div className="receipt-row"><span>会员</span><span>{receipt.member_name}</span></div>
            {receipt.services.map((s, i) => (
              <div key={i} className="receipt-row"><span>{s}</span><span>-</span></div>
            ))}
            <hr />
            <div className="receipt-row total"><span>实付</span><span>¥{receipt.total.toFixed(2)}</span></div>
            <div className="receipt-row"><span>支付方式</span><span>{receipt.payment_method}</span></div>
            <hr />
            <div className="receipt-row"><span>原余额</span><span>¥{receipt.old_balance.toFixed(2)}</span></div>
            <div className="receipt-row"><span>现余额</span><span>¥{receipt.new_balance.toFixed(2)}</span></div>
          </div>
          <button className="btn btn-primary btn-lg" onClick={() => setReceipt(null)}>确定</button>
        </div>
      </div>
    );
  }

  return (
    <div className="checkout-page">
      {toast && <div className="toast" onClick={() => setToast("")}>{toast}</div>}

      {/* 搜索区 */}
      <div className="search-bar">
        <input
          className="input input-lg"
          placeholder="🔍  输入手机号或姓名，自动搜索..."
          value={keyword}
          onChange={e => setKeyword(e.target.value)}
          onKeyDown={e => e.key === "Enter" && doSearch()}
          autoFocus
          style={{flex:1}}
        />
        {searching && <span style={{fontSize:"var(--font-size-sm)",color:"var(--text-secondary)"}}>搜索中...</span>}
      </div>

      {/* 今日消费（默认展示） */}
      {!keyword.trim() && !selected && (
        <div className="table-wrap" style={{margin:"16px 20px 0",flex:"1 1 auto",minHeight:0}}>
          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"12px 18px",borderBottom:"1px solid var(--border-light)",flexShrink:0}}>
            <h3 style={{margin:0,padding:0,border:"none",background:"transparent"}}>今日消费</h3>
            <span style={{fontSize:"var(--font-size-sm)",color:"var(--text-secondary)"}}>
              {todayRecords.length} 笔 · 收入 <strong style={{color:"var(--gold-dark)"}}>¥{todayIncome.toFixed(2)}</strong>
            </span>
          </div>
          <div className="table-scroll">
            <table className="table">
              <thead><tr><th>会员</th><th>服务</th><th>实付</th><th>支付</th><th>时间</th></tr></thead>
              <tbody>
                {todayRecords.map(r => (
                  <tr key={r.id}>
                    <td>{r.member_name}</td>
                    <td>{r.service_name}</td>
                    <td className="money">¥{r.amount.toFixed(2)}</td>
                    <td><span className={`tag ${r.payment_method==="余额"?"tag-blue":"tag-green"}`}>{r.payment_method}</span></td>
                    <td className="date">{r.created_at?.slice(0,16)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {todayRecords.length === 0 && <div className="empty-state" style={{padding:"30px 0"}}>今日暂无消费</div>}
          </div>
        </div>
      )}

      {/* 搜索结果 */}
      {searched && results.length === 0 && (
        <div className="empty-state" style={{padding:"40px 20px"}}>
          未找到会员，请在「会员管理」中添加
        </div>
      )}
      {results.length > 0 && !selected && (
        <div className="result-list">
          {results.map(m => (
            <div key={m.id} className="member-card" onClick={() => selectMember(m)}>
              <div className="member-card-name">{m.name}</div>
              <div className="member-card-info">
                <span>📱 {m.phone}</span>
                <span>余额 <strong style={{color:"var(--gold-dark)"}}>¥{m.balance.toFixed(2)}</strong></span>
                {m.total_spent > 0 && <span>累计消费 ¥{m.total_spent.toFixed(0)}</span>}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 结账区 */}
      {selected && (
        <div className="checkout-area">
          <div className="checkout-member-bar">
            <div style={{flex:1}}>
              <div className="member-label">{selected.name}</div>
            </div>
            <div className="member-balance">余额 ¥{selected.balance.toFixed(2)}</div>
            <button className="btn btn-ghost btn-sm" onClick={() => { setSelected(null); setCartItems([]); }}>切换会员</button>
          </div>

          <div className="checkout-layout">
            {/* 左侧：服务列表 */}
            <div className="service-picker">
              {Object.entries(serviceGroups).map(([cat, items]) => (
                <div key={cat} className="service-group">
                  <div className="service-cat-label">{cat}</div>
                  <div className="service-grid">
                    {items.map(s => {
                      const active = cartItems.some(i => i.id === s.id);
                      return (
                        <button
                          key={s.id}
                          className={`service-btn${active ? " active" : ""}`}
                          onClick={() => toggleCart(s.id)}
                        >
                          <span className="service-btn-name">{s.name}</span>
                          <span className="service-btn-price">¥{s.price}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>

            {/* 右侧：购物车 */}
            <div className="cart-panel">
              {/* 上半：可滚动的清单区 */}
              <div className="cart-scroll">
                <h3>待结账清单</h3>
                {cartItems.length === 0 ? (
                  <div className="cart-empty">点击左侧服务项目加入清单</div>
                ) : (
                  <>
                    <div className="cart-items">
                      {cartItems.map((item, i) => (
                        <div key={item.id} className="cart-item">
                          <span>{item.id < 0 && "✏️ "}{item.name}</span>
                          <span>¥{item.price.toFixed(2)}</span>
                          <button className="btn-icon" onClick={() => setCartItems(prev => prev.filter(c => c.id !== item.id))}>✕</button>
                        </div>
                      ))}
                    </div>
                    <div className="cart-summary">
                      <div className="cart-row total"><span>应付金额</span><span>¥{total.toFixed(2)}</span></div>
                    </div>
                  </>
                )}
              </div>

              {/* 下半：固定在底部的支付区 */}
              <div className="cart-footer">
                <div style={{display:"flex",gap:6,marginBottom:8}}>
                  <input className="input input-sm" placeholder="自定义服务名" value={customName}
                    onChange={e => setCustomName(e.target.value)}
                    onKeyDown={e => e.key==="Enter" && addCustomService()}
                    style={{flex:"1 1 0",minWidth:0}} />
                  <input className="input input-sm" type="number" placeholder="¥价格" value={customPrice}
                    onChange={e => setCustomPrice(e.target.value)}
                    onKeyDown={e => e.key==="Enter" && addCustomService()}
                    style={{width:72}} />
                  <button className="btn btn-sm btn-outline" onClick={addCustomService} style={{flexShrink:0}}>添加</button>
                </div>
                {/* 支付方式 - 横向一行 */}
                <div style={{display:"flex",gap:4,marginBottom:8,alignItems:"center"}}>
                  {["现金","微信","余额"].map(pm => (
                    <label key={pm} className="radio-label"
                      style={{flex:1,textAlign:"center",padding:"6px 0",borderRadius:6,
                              background:payment===pm?"var(--gold-light)":"var(--bg)",
                              border:payment===pm?"1px solid var(--gold)":"1px solid var(--border-light)",
                              cursor:"pointer",fontSize:"var(--font-size-sm)"}}>
                      <input type="radio" name="payment" value={pm} checked={payment===pm}
                        onChange={e => setPayment(e.target.value)} style={{display:"none"}} />
                      {pm === "现金" ? "💵 现金" : pm === "微信" ? "💚 微信" : "💳 余额"}
                    </label>
                  ))}
                </div>
                <input className="input input-sm" placeholder="备注（可选）" value={note}
                  onChange={e => setNote(e.target.value)} style={{marginBottom:8}} />
                <button
                  className="btn btn-success btn-lg btn-block"
                  disabled={cartItems.length === 0 || loading}
                  onClick={doCheckout}
                >
                  {loading ? "处理中..." : cartItems.length === 0 ? "请选择服务项目" : `✅ 确认结账  ¥${total.toFixed(2)}`}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
