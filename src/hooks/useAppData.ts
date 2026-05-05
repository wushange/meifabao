import { useState, useEffect, useCallback } from "react";
import {
  getMembers, getServices, getRecords, getLevels,
  MemberFull, ServiceItem, RecordItem, LevelInfo, RechargeItem,
  getRecharges,
} from "../db";

export interface AppData {
  members: MemberFull[];
  services: ServiceItem[];
  records: RecordItem[];
  recharges: RechargeItem[];
  levels: LevelInfo[];
  loading: boolean;
  error: string;
  reload: () => void;
}

export function useAppData(): AppData {
  const [members, setMembers] = useState<MemberFull[]>([]);
  const [services, setServices] = useState<ServiceItem[]>([]);
  const [records, setRecords] = useState<RecordItem[]>([]);
  const [recharges, setRecharges] = useState<RechargeItem[]>([]);
  const [levels, setLevels] = useState<LevelInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadAll = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [m, s, r, rg, lv] = await Promise.all([
        getMembers(), getServices(), getRecords(),
        getRecharges(), getLevels(),
      ]);
      setMembers(m);
      setServices(s);
      setRecords(r);
      setRecharges(rg);
      setLevels(lv);
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadAll(); }, [loadAll]);

  return { members, services, records, recharges, levels, loading, error, reload: loadAll };
}
