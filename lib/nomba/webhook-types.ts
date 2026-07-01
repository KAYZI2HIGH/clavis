export type NombaEventType =
  | "virtual_account.funded"
  | "transfer.success"
  | "transfer.failed"
  | "payment_success"
  | string;

export type NombaWebhookPayload = {
  event: NombaEventType;
  requestId: string;
  data: Record<string, unknown>;
};

export type VirtualAccountFundedData = {
  accountNumber: string;
  amount: number;
  currency: string;
  merchantTxRef: string;
};

export type TransferEventData = {
  merchantTxRef: string;
  amount: number;
  currency: string;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function parseNombaPayload(raw: unknown): NombaWebhookPayload | null {
  if (!isRecord(raw)) return null;
  const event = raw.event;
  const requestId = raw.requestId;
  const data = raw.data;
  if (typeof event !== "string" || typeof requestId !== "string") return null;
  if (!isRecord(data)) return null;
  return { event, requestId, data };
}

export function parseVirtualAccountFundedData(
  data: Record<string, unknown>,
): VirtualAccountFundedData | null {
  const accountNumber = data.accountNumber;
  const amount = data.amount;
  const currency = data.currency;
  const merchantTxRef = data.merchantTxRef;
  if (
    typeof accountNumber !== "string" ||
    typeof amount !== "number" ||
    typeof currency !== "string" ||
    typeof merchantTxRef !== "string"
  ) {
    return null;
  }
  return { accountNumber, amount, currency, merchantTxRef };
}

export function parseTransferEventData(
  data: Record<string, unknown>,
): TransferEventData | null {
  const merchantTxRef = data.merchantTxRef;
  const amount = data.amount;
  const currency = data.currency;
  if (
    typeof merchantTxRef !== "string" ||
    typeof amount !== "number" ||
    typeof currency !== "string"
  ) {
    return null;
  }
  return { merchantTxRef, amount, currency };
}
