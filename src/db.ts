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
}

export interface ServiceItem {
  id: number;
  name: string;
  price: number;
  category: string;
}

export interface RecordItem {
  id: number;
  member_id: number;
  member_name: string;
  service_id: number;
  service_name: string;
  amount: number;
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

export interface LevelInfo {
  name: string;
  discount: number;
  threshold: number;
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

export async function addMember(data: { name: string; phone: string; level: string; balance: number }): Promise<number> {
  return await invoke<number>("add_member", { member: { id: null, ...data } });
}

export async function updateMember(id: number, data: Partial<{ name: string; phone: string; level: string; balance: number }>): Promise<void> {
  const members = await getMembers();
  const current = members.find(m => m.id === id);
  if (!current) throw new Error("会员不存在");
  await invoke("update_member", { member: { ...current, ...data } });
}

export async function deleteMember(id: number): Promise<void> {
  await invoke("delete_member", { id });
}

export async function batchImportMembers(members: { name: string; phone: string; level?: string; balance?: number }[]): Promise<[number, number]> {
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

export async function getLevels(): Promise<LevelInfo[]> {
  return await invoke<LevelInfo[]>("get_levels");
}

export async function updateLevel(name: string, discount: number, threshold: number): Promise<void> {
  await invoke("update_level", { name, discount, threshold });
}

export async function getRecords(memberId?: number, limit?: number): Promise<RecordItem[]> {
  return await invoke<RecordItem[]>("get_records", { memberId: memberId ?? null, limit: limit ?? null });
}

export async function deleteRecord(id: number): Promise<void> {
  await invoke("delete_record", { id });
}

export async function checkout(
  memberId: number,
  serviceIds: number[],
  paymentMethod: string,
  note: string,
): Promise<CheckoutReceipt> {
  return await invoke<CheckoutReceipt>("checkout", {
    memberId, serviceIds, paymentMethod, note,
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
