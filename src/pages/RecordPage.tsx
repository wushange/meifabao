import { useState, useMemo } from "react";
import { RecordItem, deleteRecord, MemberFull, RechargeItem } from "../db";

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
  const [toast, setToast] = useState("");

  const filteredRecords = useMemo(() => {
    let list = records;
    if (search.trim()) {
      const kw = search.toLowerCase();
      list = list.filter(r => r.member_name.includes(kw) || r.service_name.includes(kw));
    }
    return list;
  }, [records, search]);

  const filteredRecharges = useMemo(() => {
    if (!search.trim()) return recharges;
    const kw = search.toLowerCase();
    return recharges.filter(r => {
      const m = members.find(x => x.id === r.member_id);
      return m?.name.includes(kw) || m?.phone.includes(kw);
    });
  }, [recharges, search, members]);

  function memberName(mid: number) {
    return members.find(m => m.id === mid)?.name || "未知";
  }

  async function doDelete(id: number) {
    if (!confirm("确定删除此记录？")) return;
    try { await deleteRecord(id); onReload(); } catch (e) { setToast("删除失败: "+e); }
  }

  return (
    <div className="page">
      {toast && <div className="toast" onClick={() => setToast("")}>{toast}</div>}
      <div className="page-header">
        <h2>📋 记录查询</h2>
        <input className="input" placeholder="搜索会员姓名..." value={search} onChange={e => setSearch(e.target.value)} style={{width:220}} />
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
              <thead><tr><th>时间</th><th>会员</th><th>服务</th><th>金额</th><th>支付</th><th>备注</th><th>操作</th></tr></thead>
              <tbody>
                {filteredRecords.map(r => (
                  <tr key={r.id}>
                    <td className="date">{r.created_at?.slice(0,16)}</td>
                    <td>{r.member_name}</td>
                    <td>{r.service_name}</td>
                    <td className="money">¥{r.amount.toFixed(2)}</td>
                    <td><span className={`tag ${r.payment_method.includes("余额")?"tag-blue":"tag-green"}`}>{r.payment_method}</span></td>
                    <td className="note">{r.note}</td>
                    <td><button className="btn btn-sm btn-danger" onClick={() => doDelete(r.id)}>删除</button></td>
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
