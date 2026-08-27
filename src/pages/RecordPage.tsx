import { useState, useMemo, useEffect } from "react";
import { RecordItem, MemberFull, RechargeItem } from "../db";
import { ListIcon } from "../components/Icons";

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
  const [payment, setPayment] = useState("全部");
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
    if (payment !== "全部") list = list.filter(r => r.payment_method === payment);
    return list;
  }, [records, search, dateFrom, dateTo, payment]);

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

  // 分页（每页 20 条，防止记录过多时整页渲染卡顿）
  const PAGE_SIZE = 20;
  const [consumePage, setConsumePage] = useState(1);
  const [rechargePage, setRechargePage] = useState(1);
  const consumeTotalPages = Math.max(1, Math.ceil(filteredRecords.length / PAGE_SIZE));
  const rechargeTotalPages = Math.max(1, Math.ceil(filteredRecharges.length / PAGE_SIZE));
  const pagedRecords = filteredRecords.slice((consumePage - 1) * PAGE_SIZE, consumePage * PAGE_SIZE);
  const pagedRecharges = filteredRecharges.slice((rechargePage - 1) * PAGE_SIZE, rechargePage * PAGE_SIZE);

  // 筛选结果变化时回到第一页
  useEffect(() => { setConsumePage(1); }, [filteredRecords.length]);
  useEffect(() => { setRechargePage(1); }, [filteredRecharges.length]);

  function memberName(mid: number) {
    return members.find(m => m.id === mid)?.name || "未知";
  }

  return (
    <div className="page">
      {toast && <div className="toast" onClick={() => setToast("")}>{toast}</div>}
      <div className="page-header">
        <h2><ListIcon size={20} /> 记录查询</h2>
        <div style={{display:"flex",gap:8,alignItems:"center",flexWrap:"wrap"}}>
          <input className="input" placeholder="搜索会员姓名..." value={search} onChange={e => setSearch(e.target.value)} style={{width:180}} />
          <input className="input" type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} style={{width:140}} title="开始日期" />
          <span style={{color:"var(--text-secondary)",fontSize:"var(--font-size-sm)"}}>至</span>
          <input className="input" type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} style={{width:140}} title="结束日期" />
          <div style={{display:"flex",gap:4}}>
            {["全部","余额","微信","现金"].map(pm => (
              <button
                key={pm}
                onClick={() => setPayment(pm)}
                style={{
                  padding:"5px 13px",
                  borderRadius:16,
                  border: payment===pm ? "1px solid var(--gold)" : "1px solid var(--border-light)",
                  background: payment===pm ? "var(--gold-light)" : "var(--bg)",
                  color: payment===pm ? "var(--gold-dark)" : "var(--text-secondary)",
                  fontSize:"var(--font-size-sm)",
                  fontWeight: payment===pm ? 600 : 400,
                  cursor:"pointer",
                }}
              >
                {pm}
              </button>
            ))}
          </div>
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
              <thead><tr><th>时间</th><th>会员</th><th>服务</th><th>实付</th><th>支付</th><th>备注</th></tr></thead>
              <tbody>
                {pagedRecords.map(r => (
                  <tr key={r.id}>
                    <td className="date">{r.created_at?.slice(0,16)}</td>
                    <td>{r.member_name}</td>
                    <td>{r.service_name}</td>
                    <td className="money">¥{r.amount.toFixed(2)}</td>
                    <td><span className={`tag ${r.payment_method==="余额"?"tag-blue":"tag-green"}`}>{r.payment_method}</span></td>
                    <td className="note">{r.note}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {filteredRecords.length === 0 && <div className="empty-state">暂无消费记录</div>}
          </div>
          <Pager page={consumePage} totalPages={consumeTotalPages} onChange={setConsumePage} />
        </div>
      )}

      {(tab === "all" || tab === "recharge") && (
        <div className="table-wrap">
          <h3>充值记录 ({filteredRecharges.length})</h3>
          <div className="table-scroll">
            <table className="table">
              <thead><tr><th>时间</th><th>会员</th><th>金额</th><th>备注</th></tr></thead>
              <tbody>
                {pagedRecharges.map(r => (
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
          <Pager page={rechargePage} totalPages={rechargeTotalPages} onChange={setRechargePage} />
        </div>
      )}
    </div>
  );
}

function Pager({ page, totalPages, onChange }: { page: number; totalPages: number; onChange: (p: number) => void }) {
  if (totalPages <= 1) return null;
  return (
    <div style={{display:"flex",justifyContent:"center",alignItems:"center",gap:10,padding:"10px 0 12px",borderTop:"1px solid var(--border-light)",marginTop:2}}>
      <button className="btn btn-sm btn-outline" disabled={page<=1} onClick={() => onChange(page-1)}>‹ 上一页</button>
      <span style={{fontSize:"var(--font-size-sm)",color:"var(--text-secondary)",minWidth:100,textAlign:"center"}}>
        {page} / {totalPages}
      </span>
      <button className="btn btn-sm btn-outline" disabled={page>=totalPages} onClick={() => onChange(page+1)}>下一页 ›</button>
    </div>
  );
}
