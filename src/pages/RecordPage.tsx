import { useState, useMemo, useEffect } from "react";
import { RecordItem, MemberFull, RechargeItem } from "../db";

interface Props {
  records: RecordItem[];
  recharges: RechargeItem[];
  members: MemberFull[];
  onReload: () => void;
}

type TabType = "all" | "consume" | "recharge";

export default function RecordPage({ records, recharges, members, onReload }: Props) {
  const [tab, setTab] = useState<TabType>("all");
  const [search, setSearch] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [toast, setToast] = useState("");

  useEffect(() => { if (toast) { const t = setTimeout(() => setToast(""), 3000); return () => clearTimeout(t); } }, [toast]);

  const filteredRecords = useMemo(() => {
    let list = records;
    if (search.trim()) {
      const kw = search.toLowerCase();
      list = list.filter(r => r.member_name.includes(kw) || r.service_name.includes(kw));
    }
    if (dateFrom) list = list.filter(r => r.created_at >= dateFrom);
    if (dateTo) list = list.filter(r => r.created_at <= dateTo + "T23:59:59");
    return list;
  }, [records, search, dateFrom, dateTo]);

  const filteredRecharges = useMemo(() => {
    let list = recharges;
    if (search.trim()) {
      const kw = search.toLowerCase();
      list = list.filter(r => {
        const m = members.find(x => x.id === r.member_id);
        return m?.name.includes(kw) || m?.phone.includes(kw);
      });
    }
    if (dateFrom) list = list.filter(r => r.created_at >= dateFrom);
    if (dateTo) list = list.filter(r => r.created_at <= dateTo + "T23:59:59");
    return list;
  }, [recharges, search, dateFrom, dateTo, members]);

  function memberName(mid: number) {
    return members.find(m => m.id === mid)?.name || "未知";
  }

  return (
    <div className="page">
      {toast && <div className="toast" onClick={() => setToast("")}>{toast}</div>}
      <div className="page-header">
        <h2>📋 记录查询</h2>
        <div style={{display:"flex",gap:8,alignItems:"center",flexWrap:"wrap"}}>
          <input className="input" placeholder="搜索会员姓名..." value={search} onChange={e => setSearch(e.target.value)} style={{width:180}} />
          <input className="input" type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} style={{width:140}} title="开始日期" />
          <span style={{color:"var(--text-secondary)",fontSize:"var(--font-size-sm)"}}>至</span>
          <input className="input" type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} style={{width:140}} title="结束日期" />
        </div>
      </div>

      <div className="tab-bar">
        <button className={`tab-btn${tab==="all"?" active":""}`} onClick={() => setTab("all")}>全部</button>
        <button className={`tab-btn${tab==="consume"?" active":""}`} onClick={() => setTab("consume")}>消费记录</button>
        <button className={`tab-btn${tab==="recharge"?" active":""}`} onClick={() => setTab("recharge")}>充值记录</button>
      </div>

      {(tab === "all" || tab === "consume") && (
        <div className="table-wrap">
          <h3>消费记录 ({filteredRecords.length})</h3>
          <div className="table-scroll">
            <table className="table">
              <thead><tr><th>时间</th><th>会员</th><th>服务</th><th>原价</th><th>折扣</th><th>实付</th><th>支付</th><th>备注</th></tr></thead>
              <tbody>
                {filteredRecords.map(r => (
                  <tr key={r.id}>
                    <td className="date">{r.created_at?.slice(0,16)}</td>
                    <td>{r.member_name}</td>
                    <td>{r.service_name}</td>
                    <td className="money">¥{(r.original_price||r.amount).toFixed(2)}</td>
                    <td className="money">{r.discount_rate < 1 ? `${(r.discount_rate*100).toFixed(0)}%` : "-"}</td>
                    <td className="money">¥{r.amount.toFixed(2)}</td>
                    <td><span className={`tag ${r.payment_method==="余额"?"tag-blue":"tag-green"}`}>{r.payment_method}</span></td>
                    <td className="note">{r.note}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {filteredRecords.length === 0 && <div className="empty-state">暂无消费记录</div>}
          </div>
        </div>
      )}

      {(tab === "all" || tab === "recharge") && (
        <div className="table-wrap">
          <h3>充值记录 ({filteredRecharges.length})</h3>
          <div className="table-scroll">
            <table className="table">
              <thead><tr><th>时间</th><th>会员</th><th>金额</th><th>备注</th></tr></thead>
              <tbody>
                {filteredRecharges.map(r => (
                  <tr key={r.id}>
                    <td className="date">{r.created_at?.slice(0,16)}</td>
                    <td>{memberName(r.member_id)}</td>
                    <td className="money" style={{color:"#16a34a"}}>+¥{r.amount.toFixed(2)}</td>
                    <td className="note">{r.note}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {filteredRecharges.length === 0 && <div className="empty-state">暂无充值记录</div>}
          </div>
        </div>
      )}
    </div>
  );
}
