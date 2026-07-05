import { log } from "@/lib/logger";
import {
  getNombaApiBaseUrl,
  getNombaAccountId,
  getNombaSubaccountId,
  getNombaClientId,
  getNombaClientSecret,
  getNombaEnvironment,
} from "@/lib/nomba/env";

export function getNombaApiBase(): string {
  const configuredBaseUrl = getNombaApiBaseUrl();
  if (configuredBaseUrl) {
    return `${configuredBaseUrl}/v1`;
  }

  return getNombaEnvironment() === "test" ?
      "https://sandbox.nomba.com/v1"
    : "https://api.nomba.com/v1";
}

function describeError(error: unknown): Record<string, unknown> {
  if (error instanceof Error) {
    const described: Record<string, unknown> = {
      error: error.message,
      name: error.name,
    };

    const cause = (error as { cause?: unknown }).cause;
    if (cause instanceof Error) {
      described.cause = cause.message;
    } else if (cause !== undefined) {
      described.cause = String(cause);
    }

    return described;
  }

  return { error: String(error) };
}

const TOKEN_TTL_MS = 60 * 60 * 1000;
const TOKEN_REFRESH_BUFFER_MS = 5 * 60 * 1000;

type TokenIssuePayload = {
  access_token: string;
};

type TokenIssueResponse = {
  data?: TokenIssuePayload;
};

type NombaErrorBody = {
  message?: string;
  error?: string;
  description?: string;
};

type NombaFetchOptions = {
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  body?: Record<string, unknown>;
  merchantTxRef: string;
};

type TokenCache = {
  accessToken: string;
  expiresAt: number;
};

let tokenCache: TokenCache | null = null;

export class NombaApiError extends Error {
  readonly statusCode: number;
  readonly nombaMessage: string;

  constructor(statusCode: number, nombaMessage: string) {
    super(`Nomba API error (${statusCode}): ${nombaMessage}`);
    this.name = "NombaApiError";
    this.statusCode = statusCode;
    this.nombaMessage = nombaMessage;
  }
}

function parseJsonResponse(rawBody: string): unknown {
  if (!rawBody) return null;

  try {
    return JSON.parse(rawBody);
  } catch {
    return rawBody;
  }
}

function parseNombaErrorMessage(body: unknown): string {
  if (typeof body === "string" && body.trim()) {
    return body;
  }

  if (typeof body === "object" && body !== null) {
    const record = body as NombaErrorBody;
    return (
      record.message ?? record.error ?? record.description ?? "Unknown error"
    );
  }

  return "Unknown error";
}

function isTokenValid(cache: TokenCache): boolean {
  return Date.now() < cache.expiresAt - TOKEN_REFRESH_BUFFER_MS;
}

export async function getAccessToken(): Promise<string> {
  if (tokenCache && isTokenValid(tokenCache)) {
    return tokenCache.accessToken;
  }

  const merchantTxRef = `auth-${Date.now()}`;
  const startedAt = Date.now();

  const TOKEN_URL = `${getNombaApiBase()}/auth/token/issue`;
  let response: Response;
  try {
    response = await fetch(TOKEN_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        accountId: getNombaAccountId(),
      },
      body: JSON.stringify({
        grant_type: "client_credentials",
        client_id: getNombaClientId(),
        client_secret: getNombaClientSecret(),
      }),
    });
  } catch (error) {
    const durationMs = Date.now() - startedAt;
    log({
      level: "error",
      event: "nomba_auth_request_failed",
      merchantTxRef,
      url: TOKEN_URL,
      environment: getNombaEnvironment(),
      durationMs,
      ...describeError(error),
    });
    throw error;
  }

  const durationMs = Date.now() - startedAt;
  const rawBody = await response.text();
  const parsed = parseJsonResponse(rawBody);

  if (!response.ok) {
    const error = parseNombaErrorMessage(parsed);
    log({
      level: "error",
      event: "nomba_auth_failed",
      merchantTxRef,
      statusCode: response.status,
      durationMs,
      error,
    });
    throw new NombaApiError(response.status, error);
  }

  const tokenResponse = parsed as TokenIssueResponse;
  const accessToken = tokenResponse.data?.access_token;
  if (!accessToken) {
    log({
      level: "error",
      event: "nomba_auth_failed",
      merchantTxRef,
      statusCode: response.status,
      durationMs,
      error: "Missing data.access_token in auth response",
    });
    throw new Error("Nomba auth failed: missing data.access_token");
  }

  tokenCache = {
    accessToken,
    expiresAt: Date.now() + TOKEN_TTL_MS,
  };

  log({
    level: "info",
    event: "nomba_auth_success",
    merchantTxRef,
    statusCode: response.status,
    durationMs,
  });

  return accessToken;
}

export async function nombaFetch<T = Record<string, unknown>>(
  path: string,
  options: NombaFetchOptions,
): Promise<T> {
  const method = options.method ?? "GET";
  const merchantTxRef = options.merchantTxRef;
  const url = path.startsWith("http") ? path : `${getNombaApiBase()}${path}`;
  const startedAt = Date.now();

  log({
    level: "info",
    event: "nomba_request",
    merchantTxRef,
    method,
    path,
  });

  const token = await getAccessToken();

  let response: Response;
  try {
    response = await fetch(url, {
      method,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
        accountId: getNombaAccountId(),
      },
      body: options.body ? JSON.stringify(options.body) : undefined,
    });
  } catch (error) {
    const durationMs = Date.now() - startedAt;
    log({
      level: "error",
      event: "nomba_request_failed",
      merchantTxRef,
      method,
      path,
      url,
      environment: getNombaEnvironment(),
      durationMs,
      ...describeError(error),
    });
    throw error;
  }

  const durationMs = Date.now() - startedAt;
  const rawBody = await response.text();
  const parsed = parseJsonResponse(rawBody);

  if (!response.ok) {
    const error = parseNombaErrorMessage(parsed);
    log({
      level: "error",
      event: "nomba_response",
      merchantTxRef,
      method,
      path,
      statusCode: response.status,
      durationMs,
      error,
    });
    throw new NombaApiError(response.status, error);
  }

  log({
    level: "info",
    event: "nomba_response",
    merchantTxRef,
    method,
    path,
    statusCode: response.status,
    durationMs,
  });

  return parsed as T;
}
