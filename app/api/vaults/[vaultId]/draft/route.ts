import { auth } from "@/auth";
import { getServiceClient } from "@/lib/supabase/service";

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ vaultId: string }> }
) {
  const session = await auth();
  if (!session?.user) {
    return Response.json(
      { error: "Unauthorized" },
      { status: 401 }
    );
  }

  const { vaultId } = await params;
  const email = session.user.email;
  const phone = session.user.phone;

  // Confirm founder
  const { data: stakeholder } = await getServiceClient()
    .from("stakeholders")
    .select("id")
    .eq("vault_id", vaultId)
    .eq("is_founder", true)
    .or(
      [email ? `email.eq.${email}` : null, phone ? `phone.eq.${phone}` : null]
        .filter(Boolean)
        .join(",")
    )
    .maybeSingle();

  if (!stakeholder) {
    return Response.json(
      { error: "Only the founder can discard a draft" },
      { status: 403 }
    );
  }

  // Delete vault — cascades to stakeholders, invites etc
  await getServiceClient()
    .from("vaults")
    .delete()
    .eq("id", vaultId)
    .eq("status", "draft");

  return Response.json({ deleted: true });
}
