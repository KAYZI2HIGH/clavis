import { getServiceClient } from "@/lib/supabase/service";

export async function incrementVaultBalanceKobo(
  vaultId: string,
  deltaKobo: number,
): Promise<{ ok: true; newBalance: number } | { ok: false; error: string }> {
  const { error } = await getServiceClient().rpc(
    "increment_vault_balance",
    {
      vault_id: vaultId,
      amount_kobo: deltaKobo,
    },
  );

  if (error) {
    return { ok: false, error: error.message };
  }

  return { ok: true, newBalance: 0 };
}

export async function incrementVaultCapitalKobo(
  vaultId: string,
  deltaKobo: number,
): Promise<{ ok: true; newBalance: number } | { ok: false; error: string }> {
  const { error } = await getServiceClient().rpc(
    "increment_vault_capital",
    {
      vault_id: vaultId,
      amount_kobo: deltaKobo,
    },
  );

  if (error) {
    return { ok: false, error: error.message };
  }

  return { ok: true, newBalance: 0 };
}

export async function deductVaultBalanceKobo(
  vaultId: string,
  amountKobo: number,
): Promise<{ ok: true; newBalance: number } | { ok: false; error: string }> {
  const { error } = await getServiceClient().rpc(
    "deduct_vault_balance",
    {
      vault_id: vaultId,
      amount_kobo: amountKobo,
    },
  );

  if (error) {
    return { ok: false, error: error.message };
  }

  return { ok: true, newBalance: 0 };
}
