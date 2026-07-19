import crypto from "crypto";
import { auth } from "@/auth";
import { getServiceClient } from "@/lib/supabase/service";
import { makeId, makeInitials } from "@/lib/vault-utils";
import { createVirtualAccount } from "@/lib/nomba/accounts";
import { log } from "@/lib/logger";
import { getBankName } from "@/lib/nigerian-banks";

export const runtime = "nodejs";



export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return Response.json(
      { error: "Unauthorized" },
      { status: 401 }
    );
  }

  const email = session.user.email;
  const phone = session.user.phone;

  const query = getServiceClient()
    .from("stakeholders")
    .select(`
      id,
      is_founder,
      vault_id,
      vaults!stakeholders_vault_id_fkey (
        id,
        name,
        quorum,
        balance_kobo,
        funding_account,
        nomba_virtual_account_number,
        nomba_virtual_account_bank,
        founder_id,
        status,
        created_at,
        updated_at,
        stakeholders!stakeholders_vault_id_fkey (
          id,
          name,
          email,
          phone,
          is_founder
        )
      )
    `);

  if (!email && !phone) {
    return Response.json({ vaults: [] });
  }

  const { data: memberships, error } = await (
    email && phone
      ? query.or(`email.eq.${email},phone.eq.${phone}`)
      : email
      ? query.eq("email", email)
      : query.eq("phone", phone!)
  );

  if (error) {
    console.error("[api/vaults GET] Error fetching vaults:", error);
    log({
      level: "error",
      event: "vaults_list_fetch_failed",
      error: error.message,
    });
    return Response.json(
      { error: "Failed to fetch vaults", details: error.message },
      { status: 500 }
    );
  }

  const vaults = memberships
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ?.map((raw) => {
      const m = raw as unknown as {
        id: string;
        is_founder: boolean;
        vault_id: string;
        vaults?: Record<string, unknown>;
        vaults_stakeholders_vault_id_fkey?: Record<string, unknown>;
        [key: string]: unknown;
      };
      const v = (m.vaults || m.vaults_stakeholders_vault_id_fkey || m["vaults!stakeholders_vault_id_fkey"]) as Record<string, unknown> | undefined;
      if (!v) return null;
      const nestedStakeholders = (v.stakeholders || v.stakeholders_stakeholders_vault_id_fkey || v["stakeholders!stakeholders_vault_id_fkey"]) as Array<{
        id: string;
        name: string;
        email?: string;
        phone?: string;
        is_founder?: boolean;
      }> | undefined;
      return {
        id: v.id as string,
        name: v.name as string,
        quorum: v.quorum as number,
        balanceKobo: Number(v.balance_kobo),
        fundingAccount: v.funding_account as string,
        nombaVirtualAccountNumber: v.nomba_virtual_account_number as string | undefined,
        nombaVirtualAccountBank: v.nomba_virtual_account_bank as string | undefined,
        founderId: v.founder_id as string,
        status: v.status as string,
        createdAt: new Date(v.created_at as string).getTime(),
        updatedAt: new Date(v.updated_at as string).getTime(),
        stakeholders: (nestedStakeholders ?? []).map((sh) => ({
          id: sh.id,
          name: sh.name,
          email: sh.email,
          phone: sh.phone,
          isFounder: sh.is_founder,
        })),
        youId: m.id,
      };
    })
    .filter(Boolean) ?? [];

  return Response.json({ vaults });
}
