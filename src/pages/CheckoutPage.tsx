import { useState, useMemo } from "react";
import {
  searchMembers, getServices, checkout,
  MemberFull, ServiceItem, CheckoutReceipt, LevelInfo,
} from "../db";

interface CustomItem {
  name: string;
  amount: number;
}

interface Props {
  levels: LevelInfo[];
  members: MemberFull[];
  onReload: () => void;
}

export default function CheckoutPage({ levels, members, onReload }: Props) {
  const [keyword, setKeyword] = useState("");
  const [results, setResults] = useState<MemberFull[]>([]);
  const [searched, setSearched] = useState(false);
  const [searching, setSearching] = useState(false);
  const [selected, setSelected] = useState<MemberFull | null>(null);
  const [services, setServices] = useState<ServiceItem[]>([]);
  const [cart, setCart] = useState<number[]>([]);
  const [customItems, setCustomItems] = useState<CustomItem[]>([]);
  const [showCustomInput, setShowCustomInput] = useState(false);
  const [customName, setCustomName] = useState("");
  const [customAmount, setCustomAmount] = useState("");
  const [payment, setPayment] = useState("余额");
  const [note, setNote] = useState("");
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState("");
  const [receipt, setReceipt] = useState<CheckoutReceipt | null>(null);

  const recentMembers = useMemo(() => {
    return [...members]
      .filter(m => m.last_visit)
      .sort((a, b) => (b.last_visit || "").localeCompare(a.last_visit || ""))
      .slice(0, 8);
  }, [members]);

  const discountRate = useMemo(() => {
    if (!selected) return 1;
    const lv = levels.find(l => l.name === selected.level);
    return lv?.discount ?? 1;
  }, [selected, levels]);

  const cartItems = useMemo(() =>
    cart.map(sid => services.find(s => s.id === sid)!).filter(Boolean)
  , [cart, services]);

  const total = cartItems.reduce((s, i) => s + (i.price * discountRate), 0)
    + customItems.reduce((s, ci) => s + ci.amount, 0);
  const original = cartItems.reduce((s, i) => s + i.price, 0)
    + customItems.reduce((s, ci) => s + ci.amount, 0);

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
    setCart([]);
    setCustomItems([]);
    setNote("");
    try { setServices(await getServices()); } catch {}
  }

  function toggleCart(sid: number) {
    setCart(prev => prev.includes(sid) ? prev.filter(id => id !== sid) : [...prev, sid]);
  }

  function addCustomItem() {
    const amt = parseFloat(customAmount);
    if (!customName.trim() || isNaN(amt) || amt <= 0) return;
    setCustomItems(prev => [...prev, { name: customName.trim(), amount: amt }]);
    setCustomName("");
    setCustomAmount("");
    setShowCustomInput(false);
  }

  function removeCustomItem(index: number) {
    setCustomItems(prev => prev.filter((_, i) => i !== index));
  }

  async function doCheckout() {
    if (!selected || (cart.length === 0 && customItems.length === 0)) return;
    if (payment === "余额" && selected.balance < total) {
      setToast(`余额不足！当前 ¥${selected.balance.toFixed(2)}，需 ¥${total.toFixed(2)}`);
      return;
    }
    setLoading(true);
    try {
      const r = await checkout(
        selected.id, cart, payment, note,
        customItems.length > 0 ? customItems : undefined,
      );
      setReceipt(r);
      setToast(`✅ 结账成功！实付 ¥${r.total.toFixed(2)}，余额 ¥${r.new_balance.toFixed(2)}`);
      setSelected(null);
      setCart([]);
      setCustomItems([]);
      setKeyword("");
      setResults([]);
      setSearched(false);
      onReload();
    } catch (e) { setToast("结账失败: " + e); }
    finally { setLoading(false); }
  }

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
          <div className="receipt-title">🧾 消费小票</div>
          <div className="receipt-body">
            <div className="receipt-row"><span>会员</span><span>{receipt.member_name}</span></div>
            {receipt.services.map((s, i) => (
              <div key={i} className="receipt-row"><span>{s}</span><span>-</span></div>
            ))}
            <hr />
            <div className="receipt-row"><span>原价</span><span>¥{receipt.original.toFixed(2)}</span></div>
            {receipt.discount > 0 && <div className="receipt-row discount"><span>折扣</span><span>-¥{receipt.discount.toFixed(2)}</span></div>}
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

      {!selected && recentMembers.length > 0 && (
        <div className="recent-section">
          <div className="section-label">🕐 最近顾客</div>
          <div className="recent-list">
            {recentMembers.map(m => (
              <button key={m.id} className="recent-chip" onClick={() => selectMember(m)}>
                <span className="recent-chip-name">{m.name}</span>
                <span className="recent-chip-level">
                  <span className={`level-tag level-${m.level}`}>{m.level}</span>
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="search-bar">
        <input
          className="input input-lg"
          placeholder="🔍  输入手机号或姓名搜索会员..."
          value={keyword}
          onChange={e => setKeyword(e.target.value)}
          onKeyDown={e => e.key === "Enter" && doSearch()}
          autoFocus
          style={{flex:1}}
        />
        <button className="btn btn-primary btn-lg" onClick={doSearch} disabled={searching}>
          {searching ? "搜索中..." : "搜索"}
        </button>
      </div>

      {searched && results.length === 0 && (
        <div className="empty-state" style={{padding:"60px 20px"}}>未找到会员，请检查输入</div>
      )}
      {results.length > 0 && !selected && (
        <div className="result-list">
          {results.map(m => (
            <div key={m.id} className="member-card" onClick={() => selectMember(m)}>
              <div className="member-card-name">{m.name}</div>
              <div className="member-card-info">
                <span>📱 {m.phone}</span>
                <span className={`level-tag level-${m.level}`}>{m.level}</span>
                <span>余额 <strong style={{color:"var(--gold-dark)"}}>¥{m.balance.toFixed(2)}</strong></span>
                {m.total_spent > 0 && <span>累计消费 ¥{m.total_spent.toFixed(0)}</span>}
              </div>
            </div>
          ))}
        </div>
      )}

      {selected && (
        <div className="checkout-area">
          <div className="checkout-member-bar">
            <div style={{flex:1}}>
              <div className="member-label">{selected.name}</div>
              <div style={{display:"flex",gap:"8px",marginTop:"3px",alignItems:"center"}}>
                <span className={`level-tag level-${selected.level}`}>{selected.level}</span>
                {discountRate < 1 && <span style={{fontSize:"var(--font-size-sm)",color:"var(--gold-dark)"}}>享 {(discountRate*100).toFixed(0)}% 折扣</span>}
              </div>
            </div>
            <div className="member-balance">余额 ¥{selected.balance.toFixed(2)}</div>
            <button className="btn btn-ghost btn-sm" onClick={() => { setSelected(null); setCart([]); setCustomItems([]); }}>切换会员</button>
          </div>

          <div className="checkout-layout">
            <div className="service-picker">
              {Object.entries(serviceGroups).map(([cat, items]) => (
                <div key={cat} className="service-group">
                  <div className="service-cat-label">{cat}</div>
                  <div className="service-grid">
                    {items.map(s => {
                      const active = cart.includes(s.id);
                      const price = (s.price * discountRate).toFixed(0);
                      return (
                        <button
                          key={s.id}
                          className={`service-btn${active ? " active" : ""}`}
                          onClick={() => toggleCart(s.id)}
                        >
                          <span className="service-btn-name">{s.name}</span>
                          <span className="service-btn-price">
                            {discountRate < 1 ? <><del>¥{s.price}</del> ¥{price}</> : `¥${s.price}`}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}

              {/* 自定义金额默认服务项 */}
              <div className="service-group">
                <div className="service-cat-label">自定义</div>
                <div className="service-grid">
                  <button
                    className={`service-btn custom${showCustomInput ? " active" : ""}`}
                    onClick={() => { setShowCustomInput(!showCustomInput); setCustomName(""); setCustomAmount(""); }}
                  >
                    <span className="service-btn-name">✚ 其他收费</span>
                    <span className="service-btn-price" style={{color:"var(--info)"}}>手动输入</span>
                  </button>
                </div>
                {showCustomInput && (
                  <div style={{marginTop:10,display:"flex",gap:8,alignItems:"center",flexWrap:"wrap"}}>
                    <input className="input input-sm" placeholder="项目名称" value={customName}
                      onChange={e => setCustomName(e.target.value)}
                      style={{flex:1,minWidth:100}} autoFocus />
                    <input className="input input-sm" placeholder="金额" type="number" step="0.01" min="0"
                      value={customAmount}
                      onChange={e => setCustomAmount(e.target.value)}
                      onKeyDown={e => e.key === "Enter" && addCustomItem()}
                      style={{width:90}} />
                    <button className="btn btn-primary btn-sm" onClick={addCustomItem}
                      disabled={!customName.trim() || !customAmount}>确认</button>
                    <button className="btn btn-ghost btn-sm" onClick={() => setShowCustomInput(false)}>取消</button>
                  </div>
                )}
              </div>
            </div>

            <div className="cart-panel">
              <div className="cart-scroll">
                <h3>待结账清单</h3>
                {cartItems.length === 0 && customItems.length === 0 ? (
                  <div className="cart-empty">点击左侧服务项目加入清单</div>
                ) : (
                  <>
                    <div className="cart-items">
                      {cartItems.map((item, i) => (
                        <div key={i} className="cart-item">
                          <span>{item.name}</span>
                          <span>¥{(item.price * discountRate).toFixed(2)}</span>
                          <button className="btn-icon" onClick={() => toggleCart(item.id)}>✕</button>
                        </div>
                      ))}
                      {customItems.map((ci, i) => (
                        <div key={`c${i}`} className="cart-item" style={{background:"var(--info-bg)"}}>
                          <span>✨ {ci.name}</span>
                          <span>¥{ci.amount.toFixed(2)}</span>
                          <button className="btn-icon" onClick={() => removeCustomItem(i)}>✕</button>
                        </div>
                      ))}
                    </div>
                    <div className="cart-summary">
                      {discountRate < 1 && (
                        <div className="cart-row"><span>原价合计</span><span>¥{original.toFixed(2)}</span></div>
                      )}
                      {discountRate < 1 && (
                        <div className="cart-row discount"><span>折扣 {(discountRate*100).toFixed(0)}%</span><span>-¥{(original-total).toFixed(2)}</span></div>
                      )}
                      <div className="cart-row total"><span>应付金额</span><span>¥{total.toFixed(2)}</span></div>
                    </div>
                  </>
                )}
              </div>

              <div className="cart-footer">
                <div className="cart-payment">
                  <label className="radio-label">
                    <input type="radio" name="payment" value="现金" checked={payment==="现金"} onChange={e => setPayment(e.target.value)} />
                    💵 现金
                  </label>
                  <label className="radio-label">
                    <input type="radio" name="payment" value="余额" checked={payment==="余额"} onChange={e => setPayment(e.target.value)} />
                    💳 余额
                  </label>
                </div>
                <input
                  className="input"
                  placeholder="备注（可选）"
                  value={note}
                  onChange={e => setNote(e.target.value)}
                />
                <button
                  className="btn btn-success btn-lg btn-block"
                  disabled={(cartItems.length === 0 && customItems.length === 0) || loading}
                  onClick={doCheckout}
                >
                  {loading ? "处理中..." : (cartItems.length === 0 && customItems.length === 0) ? "请选择服务项目" : `✅ 确认结账  ¥${total.toFixed(2)}`}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
