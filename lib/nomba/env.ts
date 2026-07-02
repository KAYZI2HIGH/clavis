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

function requireEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`${name} is required but was not set`);
  }
  return value;
}

export function getNombaClientId(): string {
  return requireEnv("NOMBA_CLIENT_ID");
}

export function getNombaClientSecret(): string {
  return requireEnv("NOMBA_CLIENT_SECRET");
}

export function getNombaAccountId(): string {
  return requireEnv("NOMBA_ACCOUNT_ID");
}

export function getNombaSubaccountId(): string {
  return requireEnv("NOMBA_SUBACCOUNT_ID");
}

export function getNombaEnvironment(): "test" | "live" {
  const configured = process.env.NOMBA_ENV?.trim().toLowerCase();
  if (configured === "live" || configured === "test") {
    return configured;
  }

  const clientId = process.env.NOMBA_CLIENT_ID?.toLowerCase() ?? "";
  if (clientId.includes("live") || clientId.includes("prod")) {
    return "live";
  }

  return "test";
}
