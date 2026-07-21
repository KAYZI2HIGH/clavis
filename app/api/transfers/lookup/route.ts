import { validateBankAccount } from "@/lib/monnify/transfers";
import { log } from "@/lib/logger";

export const runtime = "nodejs";

type LookupRequestBody = {
  accountNumber?: string;
  bankCode?: string;
};

export async function POST(request: Request) {
  let body: LookupRequestBody;

  try {
    body = (await request.json()) as LookupRequestBody;
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const accountNumber = body.accountNumber?.trim();
  const bankCode = body.bankCode?.trim();

  if (!accountNumber || !bankCode) {
    return Response.json(
      { error: "accountNumber and bankCode are required" },
      { status: 400 },
    );
  }

  try {
    const recipient = await validateBankAccount(accountNumber, bankCode);
    return Response.json(recipient);
  } catch (err) {
    const message =
      err instanceof Error && err.message.includes("Failed")
        ? err.message
        : "Could not verify account details. Check the account number and bank code.";

    log({
      level: "warn",
      event: "recipient_lookup_failed",
      accountNumber,
      bankCode,
      error: err instanceof Error ? err.message : String(err),
    });

    return Response.json({ error: message }, { status: 422 });
  }
}
