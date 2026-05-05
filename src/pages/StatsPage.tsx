import { useMemo } from "react";
import { MemberFull, RecordItem, RechargeItem } from "../db";

interface Props {
  members: MemberFull[];
  records: RecordItem[];
  recharges: RechargeItem[];
}

export default function StatsPage({ members, records, recharges }: Props) {
  const today = new Date().toDateString();

  const stats = useMemo(() => {
    const todayRecords = records.filter(r => new Date(r.created_at).toDateString() === today);
    const todayRecharges = recharges.filter(r => new Date(r.created_at).toDateString() === today);
    const todayIncome = todayRecords.reduce((s, r) => s + r.amount, 0);
    const todayRechargeTotal = todayRecharges.reduce((s, r) => s + r.amount, 0);
    const totalBalance = members.reduce((s, m) => s + m.balance, 0);
    const totalRechargeAmount = recharges.reduce((s, r) => s + r.amount, 0);

    // 等级分布
    const levelDist: Record<string, number> = {};
    members.forEach(m => { levelDist[m.level] = (levelDist[m.level] || 0) + 1; });

    // 近7天趋势
    const last7Days: { date: string; income: number; count: number }[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const ds = d.toDateString();
      const dayRecords = records.filter(r => new Date(r.created_at).toDateString() === ds);
      last7Days.push({
        date: `${d.getMonth()+1}/${d.getDate()}`,
        income: dayRecords.reduce((s, r) => s + r.amount, 0),
        count: dayRecords.length,
      });
    }

    // Top 服务
    const serviceCount: Record<string, number> = {};
    records.forEach(r => {
      serviceCount[r.service_name] = (serviceCount[r.service_name] || 0) + 1;
    });
    const topServices = Object.entries(serviceCount)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);

    return { todayRecords, todayIncome, todayRechargeTotal, totalBalance, totalRechargeAmount, levelDist, last7Days, topServices };
  }, [members, records, recharges]);

  return (
    <div className="page">
      <h2>📊 数据概览</h2>

      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-value">{members.length}</div>
          <div className="stat-label">会员总数</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">¥{stats.totalBalance.toFixed(0)}</div>
          <div className="stat-label">会员余额总计</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{stats.todayRecords.length}</div>
          <div className="stat-label">今日消费笔数</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">¥{stats.todayIncome.toFixed(0)}</div>
          <div className="stat-label">今日收入</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">¥{stats.todayRechargeTotal.toFixed(0)}</div>
          <div className="stat-label">今日充值</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">¥{stats.totalRechargeAmount.toFixed(0)}</div>
          <div className="stat-label">储值总额</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{records.length}</div>
          <div className="stat-label">累计消费笔数</div>
        </div>
      </div>

      <div className="stats-row">
        {/* 等级分布 */}
        <div className="stats-panel">
          <h3>会员等级分布</h3>
          <div className="level-bars">
            {Object.entries(stats.levelDist).map(([lv, count]) => (
              <div key={lv} className="level-bar-row">
                <span className={`level-tag level-${lv}`}>{lv}</span>
                <div className="level-bar-track">
                  <div className="level-bar-fill" style={{width: `${members.length ? (count/members.length*100) : 0}%`}} />
                </div>
                <span className="level-bar-count">{count}人</span>
              </div>
            ))}
          </div>
        </div>

        {/* 近7天趋势 */}
        <div className="stats-panel">
          <h3>近7天收入趋势</h3>
          <div className="chart-bars">
            {stats.last7Days.map(d => {
              const maxIncome = Math.max(...stats.last7Days.map(x => x.income), 1);
              const h = (d.income / maxIncome * 100).toFixed(0);
              return (
                <div key={d.date} className="chart-bar-col">
                  <div className="chart-bar-val">¥{d.income.toFixed(0)}</div>
                  <div className="chart-bar" style={{height: `${h}%`, minHeight: d.income > 0 ? '4px' : '0'}} />
                  <div className="chart-bar-label">{d.date}</div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Top 服务 */}
      <div className="stats-panel">
        <h3>热门服务 TOP5</h3>
        <div className="level-bars">
          {stats.topServices.map(([name, count]) => (
            <div key={name} className="level-bar-row">
              <span>{name}</span>
              <div className="level-bar-track">
                <div className="level-bar-fill" style={{width: `${stats.topServices[0] ? (count/stats.topServices[0][1]*100) : 0}%`}} />
              </div>
              <span className="level-bar-count">{count}次</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
