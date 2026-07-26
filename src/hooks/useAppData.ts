import { useState, useEffect, useCallback, useRef } from "react";
import {
  getMembers, getServices, getRecords,
  MemberFull, ServiceItem, RecordItem, RechargeItem,
  getRecharges,
} from "../db";

export interface AppData {
  members: MemberFull[];
  services: ServiceItem[];
  records: RecordItem[];
  recharges: RechargeItem[];
  loading: boolean;
  error: string;
  reload: () => void;
}

export function useAppData(): AppData {
  const [members, setMembers] = useState<MemberFull[]>([]);
  const [services, setServices] = useState<ServiceItem[]>([]);
  const [records, setRecords] = useState<RecordItem[]>([]);
  const [recharges, setRecharges] = useState<RechargeItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const initialLoadDone = useRef(false);

  const loadAll = useCallback(async (showLoading = true) => {
    if (showLoading) setLoading(true);
    setError("");
    try {
      const [m, s, r, rg] = await Promise.all([
        getMembers(), getServices(), getRecords(),
        getRecharges(),
      ]);
      setMembers(m);
      setServices(s);
      setRecords(r);
      setRecharges(rg);
    } catch (e) {
      setError(String(e));
    } finally {
      if (showLoading) setLoading(false);
    }
  }, []);

  // 首次加载：显示 loading
  useEffect(() => {
    loadAll(true).then(() => { initialLoadDone.current = true; });
  }, [loadAll]);

  // 静默刷新：不显示 loading，不卸载子组件
  const reload = useCallback(() => {
    loadAll(false);
  }, [loadAll]);

  return { members, services, records, recharges, loading, error, reload };
}
