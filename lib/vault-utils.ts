import type { Vault } from "./types";

export function makeInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "??";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export function makeId(prefix: string): string {
  return `${prefix}-${Math.random().toString(36).slice(2, 9)}`;
}

export function makeFundingAccount(): string {
  const g = () => Math.floor(1000 + Math.random() * 9000).toString();
  return `ACME-VLT-${g()}-${g().slice(0, 4)}-${g().slice(0, 2)}`;
}

export function updateActiveVault(
  vaults: Vault[],
  activeId: string | null,
  fn: (v: Vault) => Vault,
): Vault[] {
  if (!activeId) return vaults;
  return vaults.map((v) => (v.id === activeId ? fn(v) : v));
}

export function getActiveVault(
  vaults: Vault[],
  activeVaultId: string | null,
): Vault | null {
  if (!activeVaultId) return null;
  return vaults.find((v) => v.id === activeVaultId) ?? null;
}
