import { useState, useMemo } from "react";
import {
  searchMembers, getServices, checkout,
  MemberFull, ServiceItem, CheckoutReceipt, LevelInfo,
} from "../db";

interface Props {
  levels: LevelInfo[];
  onReload: () => void;
}

export default function CheckoutPage({ levels, onReload }: Props) {
  const [keyword, setKeyword] = useState("");
  const [results, setResults] = useState<MemberFull[]>([]);
  const [searched, setSearched] = useState(false);
  const [searching, setSearching] = useState(false);
  const [selected, setSelected] = useState<MemberFull | null>(null);
  const [services, setServices] = useState<ServiceItem[]>([]);
  const [cart, setCart] = useState<number[]>([]);
  const [payment, setPayment] = useState("余额");
  const [note, setNote] = useState("");
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState("");
  const [receipt, setReceipt] = useState<CheckoutReceipt | null>(null);

  const discountRate = useMemo(() => {
    if (!selected) return 1;
    const lv = levels.find(l => l.name === selected.level);
    return lv?.discount ?? 1;
  }, [selected, levels]);

  const cartItems = useMemo(() =>
    cart.map(sid => services.find(s => s.id === sid)!).filter(Boolean)
  , [cart, services]);

  const total = cartItems.reduce((s, i) => s + (i.price * discountRate), 0);
  const original = cartItems.reduce((s, i) => s + i.price, 0);

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
    setNote("");
    try { setServices(await getServices()); } catch {}
  }

  function toggleCart(sid: number) {
    setCart(prev => prev.includes(sid) ? prev.filter(id => id !== sid) : [...prev, sid]);
  }

  async function doCheckout() {
    if (!selected || cart.length === 0) return;
    if (payment === "余额" && selected.balance < total) {
      setToast(`余额不足！当前 ¥${selected.balance.toFixed(2)}，需 ¥${total.toFixed(2)}`);
      return;
    }
    setLoading(true);
    try {
      const r = await checkout(selected.id, cart, payment, note);
      setReceipt(r);
      setToast(`✅ 结账成功！实付 ¥${r.total.toFixed(2)}，余额 ¥${r.new_balance.toFixed(2)}`);
      setSelected(null);
      setCart([]);
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

      {/* 搜索区 */}
      <div className="search-bar">
        <input
          className="input-lg"
          placeholder="输入手机号或姓名搜索会员"
          value={keyword}
          onChange={e => setKeyword(e.target.value)}
          onKeyDown={e => e.key === "Enter" && doSearch()}
          autoFocus
        />
        <button className="btn btn-primary btn-lg" onClick={doSearch} disabled={searching}>
          {searching ? "搜索中..." : "🔍 搜索"}
        </button>
      </div>

      {/* 搜索结果 */}
      {searched && results.length === 0 && (
        <div className="empty-state">未找到会员，请检查输入</div>
      )}
      {results.length > 0 && !selected && (
        <div className="result-list">
          {results.map(m => (
            <div key={m.id} className="member-card" onClick={() => selectMember(m)}>
              <div className="member-card-name">{m.name}</div>
              <div className="member-card-info">
                <span>{m.phone}</span>
                <span className={`level-tag level-${m.level}`}>{m.level}</span>
                <span>余额 ¥{m.balance.toFixed(2)}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 结账区 */}
      {selected && (
        <div className="checkout-area">
          <div className="checkout-member-bar">
            <span className="member-label">{selected.name} · {selected.level}</span>
            <span className="member-balance">余额 ¥{selected.balance.toFixed(2)}</span>
            <button className="btn btn-sm" onClick={() => { setSelected(null); setCart([]); }}>换人</button>
          </div>

          <div className="checkout-layout">
            {/* 左侧：服务列表 */}
            <div className="service-picker">
              <h3>选择服务</h3>
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
            </div>

            {/* 右侧：购物车 */}
            <div className="cart-panel">
              <h3>待结账</h3>
              {cartItems.length === 0 ? (
                <div className="empty-state">请选择服务项目</div>
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
                  </div>
                  <div className="cart-summary">
                    {discountRate < 1 && (
                      <div className="cart-row"><span>原价</span><span>¥{original.toFixed(2)}</span></div>
                    )}
                    {discountRate < 1 && (
                      <div className="cart-row discount">会员折扣 {(discountRate*100).toFixed(0)}%</div>
                    )}
                    <div className="cart-row total"><span>合计</span><span>¥{total.toFixed(2)}</span></div>
                  </div>
                </>
              )}

              <div className="cart-payment">
                <label className="radio-label">
                  <input type="radio" name="payment" value="现金" checked={payment==="现金"} onChange={e => setPayment(e.target.value)} />
                  现金支付
                </label>
                <label className="radio-label">
                  <input type="radio" name="payment" value="余额" checked={payment==="余额"} onChange={e => setPayment(e.target.value)} />
                  余额支付
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
                disabled={cartItems.length === 0 || loading}
                onClick={doCheckout}
              >
                {loading ? "处理中..." : `确认结账 ¥${total.toFixed(2)}`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
