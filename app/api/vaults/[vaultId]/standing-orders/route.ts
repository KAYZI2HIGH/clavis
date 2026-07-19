import { auth } from "@/auth";
import { getServiceClient } from "@/lib/supabase/service";
import { makeId } from "@/lib/vault-utils";
import { log } from "@/lib/logger";
import type { StandingOrderCondition, StandingOrderAction } from "@/lib/types";

export const runtime = "nodejs";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ vaultId: string }> }
) {
  const session = await auth();
  if (!session?.user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { vaultId } = await params;

  let body: {
    orders: Array<{
      conditions: StandingOrderCondition[];
      action: StandingOrderAction;
      notify_window_hours?: number;
      plain_language: string;
    }>;
  };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const email = session.user.email;
  const phone = session.user.phone;
  if (!email && !phone) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  // 1. Fetch vault and confirm status is draft
  const { data: vault, error: vaultError } = await getServiceClient()
    .from("vaults")
    .select("status, investor_id")
    .eq("id", vaultId)
    .single();

  if (vaultError || !vault) {
    return Response.json({ error: "Vault not found" }, { status: 404 });
  }

  if (vault.status !== "draft") {
    return Response.json({ error: "Vault is no longer in draft status" }, { status: 400 });
  }

  // 2. Confirm requester is the vault investor
  const { data: investor, error: shError } = await getServiceClient()
    .from("stakeholders")
    .select("id")
    .eq("vault_id", vaultId)
    .eq("is_investor", true)
    .eq("id", vault.investor_id)
    .or(email && phone ? `email.eq.${email},phone.eq.${phone}` : email ? `email.eq.${email}` : `phone.eq.${phone}`)
    .single();

  if (shError || !investor) {
    return Response.json({ error: "Unauthorized to set standing orders" }, { status: 403 });
  }

  // 3. Insert each order
  if (body.orders && body.orders.length > 0) {
    const ordersToInsert = body.orders.map(order => ({
      id: makeId("so"),
      vault_id: vaultId,
      proposed_by: investor.id,
      status: "active",
      conditions: order.conditions,
      action: order.action,
      notify_window_hours: order.notify_window_hours ?? null,
      plain_language: order.plain_language,
      created_at: new Date().toISOString(),
      activated_at: new Date().toISOString(),
    }));

    const { error: insertError } = await getServiceClient()
      .from("standing_orders")
      .insert(ordersToInsert);

    if (insertError) {
      log({
        level: "error",
        event: "standing_orders_insert_failed",
        vaultId,
        error: insertError.message,
      });
      return Response.json({ error: "Failed to create standing orders" }, { status: 500 });
    }
  }

  return Response.json({ created: body.orders?.length ?? 0 });
}
