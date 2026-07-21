export function requireEnv(name: string): string {
  let value: string | undefined;
  if (name === "MONNIFY_API_KEY") value = process.env.MONNIFY_API_KEY;
  else if (name === "MONNIFY_SECRET_KEY") value = process.env.MONNIFY_SECRET_KEY;
  else if (name === "MONNIFY_CONTRACT_CODE") value = process.env.MONNIFY_CONTRACT_CODE;
  else if (name === "MONNIFY_WALLET_ACCOUNT_NUMBER") value = process.env.MONNIFY_WALLET_ACCOUNT_NUMBER;
  else value = process.env[name];
  
  value = value?.trim();
  if (!value) {
    throw new Error(`${name} is required but was not set`);
  }
  return value;
}

export function getMonnifyApiKey(): string {
  return requireEnv("MONNIFY_API_KEY");
}

export function getMonnifySecretKey(): string {
  return requireEnv("MONNIFY_SECRET_KEY");
}

export function getMonnifyContractCode(): string {
  return requireEnv("MONNIFY_CONTRACT_CODE");
}

export function getMonnifyWalletAccountNumber(): string {
  return requireEnv("MONNIFY_WALLET_ACCOUNT_NUMBER");
}

export function getMonnifyEnvironment(): "test" | "live" {
  const configured = process.env.MONNIFY_ENV?.trim().toLowerCase();
  if (configured === "live" || configured === "test") {
    return configured;
  }
  
  const apiKey = process.env.MONNIFY_API_KEY?.toLowerCase() ?? "";
  if (apiKey.includes("prod") || apiKey.includes("live")) {
    return "live";
  }
  
  return "test";
}

export function getMonnifyApiBaseUrl(): string {
  const baseUrl = process.env.MONNIFY_API_BASE_URL?.trim();
  if (baseUrl) {
    return baseUrl.replace(/\/$/, "");
  }
  return getMonnifyEnvironment() === "test" 
    ? "https://sandbox.monnify.com" 
    : "https://api.monnify.com";
}

/** Called from instrumentation on server startup. */
export function assertMonnifyConfigured(): void {
  getMonnifySecretKey();
  getMonnifyApiKey();
  getMonnifyContractCode();
  getMonnifyWalletAccountNumber();
}
