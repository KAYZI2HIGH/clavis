import { getServiceClient } from "@/lib/supabase/service";

export async function incrementVaultBalanceKobo(
  vaultId: string,
  deltaKobo: number,
): Promise<{ ok: true; newBalance: number } | { ok: false; error: string }> {
  const { data, error } = await getServiceClient().rpc(
    "increment_vault_balance",
    {
      p_vault_id: vaultId,
      p_delta_kobo: deltaKobo,
    },
  );

  if (error) {
    return { ok: false, error: error.message };
  }

  return { ok: true, newBalance: data as number };
}

export async function deductVaultBalanceKobo(
  vaultId: string,
  amountKobo: number,
): Promise<{ ok: true; newBalance: number } | { ok: false; error: string }> {
  const { data, error } = await getServiceClient().rpc(
    "deduct_vault_balance",
    {
      p_vault_id: vaultId,
      p_amount_kobo: amountKobo,
    },
  );

  if (error) {
    return { ok: false, error: error.message };
  }

  return { ok: true, newBalance: data as number };
}
