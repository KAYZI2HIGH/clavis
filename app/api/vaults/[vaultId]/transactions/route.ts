import { auth } from "@/auth";
import { getServiceClient } from "@/lib/supabase/service";
import { makeId } from "@/lib/vault-utils";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ vaultId: string }> }
) {
  const session = await auth();
  if (!session?.user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { vaultId } = await params;
  const {
    recipientName,
    recipientAccount,
    recipientBankCode,
    amountKobo,
    memo,
  } = await request.json();

  // Validate required fields
  if (!recipientName || !recipientAccount || 
      !recipientBankCode || !amountKobo) {
    return Response.json(
      { error: "Missing required fields" },
      { status: 400 }
    );
  }

  // Confirm requester is a vault member
  const { data: member } = await getServiceClient()
    .from("stakeholders")
    .select("id")
    .eq("vault_id", vaultId)
    .eq("email", session.user.email)
    .maybeSingle();

  if (!member) {
    return Response.json(
      { error: "Not a vault member" },
      { status: 403 }
    );
  }

  // Confirm vault has sufficient balance
  const { data: vault } = await getServiceClient()
    .from("vaults")
    .select("balance_kobo, quorum")
    .eq("id", vaultId)
    .maybeSingle();

  if (!vault) {
    return Response.json(
      { error: "Vault not found" },
      { status: 404 }
    );
  }

  if (amountKobo > vault.balance_kobo) {
    return Response.json(
      { error: "Insufficient vault balance" },
      { status: 400 }
    );
  }

  // Insert transaction
  const { data: transaction, error } = await getServiceClient()
    .from("transactions")
    .insert({
      id: makeId("tx"),
      vault_id: vaultId,
      requested_by: member.id,
      recipient_name: recipientName,
      recipient_account: recipientAccount,
      recipient_bank_code: recipientBankCode,
      amount_kobo: amountKobo,
      memo: memo || "",
      narration: memo || recipientName,
      status: "pending",
      required_quorum: vault.quorum,
      requested_at: new Date().toISOString(),
      nomba_tx_ref: makeId("ref"),
    })
    .select()
    .single();

  if (error) {
    return Response.json(
      { error: "Failed to create transaction" },
      { status: 500 }
    );
  }

  return Response.json({ transaction }, { status: 201 });
}
