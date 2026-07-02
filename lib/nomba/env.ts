const MISSING_SECRET_ERROR =
  "NOMBA_WEBHOOK_SECRET is required but was not set";

let cachedSecret: string | undefined;

export function getNombaWebhookSecret(): string {
  if (cachedSecret) return cachedSecret;

  const secret = process.env.NOMBA_WEBHOOK_SECRET?.trim();
  if (!secret) {
    throw new Error(MISSING_SECRET_ERROR);
  }

  cachedSecret = secret;
  return cachedSecret;
}

/** Called from instrumentation on server startup. */
export function assertNombaWebhookConfigured(): void {
  getNombaWebhookSecret();
}
