import { invoke } from "@tauri-apps/api/core";

// ═══ 类型定义 ═══
export interface MemberFull {
  id: number;
  name: string;
  phone: string;
  level: string;
  balance: number;
  total_spent: number;
  created_at: string;
  last_visit: string | null;
  note: string;
}

export interface ServiceItem {
  id: number;
  name: string;
  price: number;
  category: string;
}

export interface RecordItem {
  id: number;
  order_id: number;
  member_id: number;
  member_name: string;
  service_id: number;
  service_name: string;
  amount: number;
  original_price: number;
  discount_rate: number;
  payment_method: string;
  note: string;
  created_at: string;
}

export interface RechargeItem {
  id: number;
  member_id: number;
  amount: number;
  note: string;
  created_at: string;
}

export interface CheckoutReceipt {
  member_name: string;
  services: string[];
  original: number;
  discount: number;
  total: number;
  payment_method: string;
  old_balance: number;
  new_balance: number;
}

// ═══ API ═══

export async function getMembers(): Promise<MemberFull[]> {
  return await invoke<MemberFull[]>("get_members");
}

export async function searchMembers(keyword: string): Promise<MemberFull[]> {
  return await invoke<MemberFull[]>("search_members", { keyword });
}

export async function addMember(data: { name: string; phone: string; balance: number; note?: string }): Promise<number> {
  return await invoke<number>("add_member", { member: { id: null, ...data } });
}

export async function updateMember(id: number, data: Partial<{ name: string; phone: string; level: string; balance: number; note: string }>): Promise<void> {
  const members = await getMembers();
  const current = members.find(m => m.id === id);
  if (!current) throw new Error("会员不存在");
  await invoke("update_member", { member: { ...current, ...data } });
}

export async function deleteMember(id: number): Promise<void> {
  await invoke("delete_member", { id });
}

export async function batchImportMembers(members: { name: string; phone: string; level?: string; balance?: number; note?: string; total_spent?: number }[]): Promise<[number, number]> {
  return await invoke<[number, number]>("batch_import_members", { members });
}

export async function getServices(): Promise<ServiceItem[]> {
  return await invoke<ServiceItem[]>("get_services");
}

export async function addService(name: string, price: number, category: string): Promise<number> {
  return await invoke<number>("add_service", { name, price, category });
}

export async function updateService(id: number, name: string, price: number, category: string): Promise<void> {
  await invoke("update_service", { id, name, price, category });
}

export async function deleteService(id: number): Promise<void> {
  await invoke("delete_service", { id });
}

export async function getRecords(memberId?: number, limit?: number): Promise<RecordItem[]> {
  return await invoke<RecordItem[]>("get_records", { memberId: memberId ?? null, limit: limit ?? null });
}

export async function deleteRecord(id: number): Promise<void> {
  await invoke("delete_record", { id });
}

export interface CustomService {
  name: string;
  price: number;
}

export async function checkout(
  memberId: number,
  serviceIds: number[],
  customServices: CustomService[],
  paymentMethod: string,
  note: string,
): Promise<CheckoutReceipt> {
  return await invoke<CheckoutReceipt>("checkout", {
    memberId, serviceIds, customServices, paymentMethod, note,
  });
}

export async function recharge(memberId: number, amount: number, note: string): Promise<number> {
  return await invoke<number>("recharge", { memberId, amount, note });
}

export async function getRecharges(memberId?: number): Promise<RechargeItem[]> {
  return await invoke<RechargeItem[]>("get_recharges", { memberId: memberId ?? null });
}

export async function exportAllData(): Promise<string> {
  return await invoke<string>("export_all_data");
}

export async function clearAllData(): Promise<void> {
  await invoke("clear_all_data");
}

export interface DailyBackupResult {
  backed_up: boolean;
  path: string;
  message: string;
}

export interface BackupConfig {
  backup_dir: string;
  backup_keep_days: number;
  backup_hour: number;
}

export async function dailyBackup(): Promise<DailyBackupResult> {
  return await invoke<DailyBackupResult>("daily_backup");
}

export async function manualBackup(): Promise<DailyBackupResult> {
  return await invoke<DailyBackupResult>("manual_backup");
}

export async function getBackupConfig(): Promise<BackupConfig> {
  return await invoke<BackupConfig>("get_backup_config");
}

export async function saveBackupConfig(config: BackupConfig): Promise<void> {
  await invoke("save_backup_config", { config });
}
