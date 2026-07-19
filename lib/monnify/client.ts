import { log } from "@/lib/logger";
import {
  getMonnifyApiBaseUrl,
  getMonnifyApiKey,
  getMonnifySecretKey,
  getMonnifyEnvironment,
} from "@/lib/monnify/env";

export function getMonnifyApiBase(): string {
  return getMonnifyApiBaseUrl();
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

type TokenIssueResponse = {
  requestSuccessful?: boolean;
  responseMessage?: string;
  responseCode?: string;
  responseBody?: {
    accessToken: string;
    expiresIn: number;
  };
};

type MonnifyErrorBody = {
  requestSuccessful?: boolean;
  responseMessage?: string;
  responseCode?: string;
};

type MonnifyFetchOptions = {
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  body?: Record<string, unknown>;
  merchantTxRef: string;
};

type TokenCache = {
  accessToken: string;
  expiresAt: number;
};

let tokenCache: TokenCache | null = null;

export class MonnifyApiError extends Error {
  readonly statusCode: number;
  readonly monnifyMessage: string;

  constructor(statusCode: number, monnifyMessage: string) {
    super(`Monnify API error (${statusCode}): ${monnifyMessage}`);
    this.name = "MonnifyApiError";
    this.statusCode = statusCode;
    this.monnifyMessage = monnifyMessage;
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

function parseMonnifyErrorMessage(body: unknown): string {
  if (typeof body === "string" && body.trim()) {
    return body;
  }
  if (typeof body === "object" && body !== null) {
    const record = body as MonnifyErrorBody;
    return record.responseMessage ?? "Unknown error";
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
  const url = `${getMonnifyApiBase()}/api/v1/auth/login`;

  const credentials = Buffer.from(
    `${getMonnifyApiKey()}:${getMonnifySecretKey()}`
  ).toString("base64");

  let response: Response;
  try {
    response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Basic ${credentials}`,
      },
    });
  } catch (error) {
    const durationMs = Date.now() - startedAt;
    log({
      level: "error",
      event: "monnify_auth_request_failed",
      merchantTxRef,
      url,
      environment: getMonnifyEnvironment(),
      durationMs,
      ...describeError(error),
    });
    throw error;
  }

  const durationMs = Date.now() - startedAt;
  const rawBody = await response.text();
  const parsed = parseJsonResponse(rawBody);

  if (!response.ok) {
    const error = parseMonnifyErrorMessage(parsed);
    log({
      level: "error",
      event: "monnify_auth_failed",
      merchantTxRef,
      statusCode: response.status,
      durationMs,
      error,
    });
    throw new MonnifyApiError(response.status, error);
  }

  const tokenResponse = parsed as TokenIssueResponse;
  const accessToken = tokenResponse.responseBody?.accessToken;
  
  if (!accessToken) {
    log({
      level: "error",
      event: "monnify_auth_failed",
      merchantTxRef,
      statusCode: response.status,
      durationMs,
      error: "Missing responseBody.accessToken in auth response",
    });
    throw new Error("Monnify auth failed: missing accessToken");
  }

  tokenCache = {
    accessToken,
    expiresAt: Date.now() + TOKEN_TTL_MS,
  };

  log({
    level: "info",
    event: "monnify_auth_success",
    merchantTxRef,
    statusCode: response.status,
    durationMs,
  });

  return accessToken;
}

export async function monnifyFetch<T = Record<string, unknown>>(
  path: string,
  options: MonnifyFetchOptions
): Promise<T> {
  const method = options.method ?? "GET";
  const merchantTxRef = options.merchantTxRef;
  const url = path.startsWith("http") ? path : `${getMonnifyApiBase()}${path}`;
  const startedAt = Date.now();

  log({
    level: "info",
    event: "monnify_request",
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
      },
      body: options.body ? JSON.stringify(options.body) : undefined,
    });
  } catch (error) {
    const durationMs = Date.now() - startedAt;
    log({
      level: "error",
      event: "monnify_request_failed",
      merchantTxRef,
      method,
      path,
      url,
      environment: getMonnifyEnvironment(),
      durationMs,
      ...describeError(error),
    });
    throw error;
  }

  const durationMs = Date.now() - startedAt;
  const rawBody = await response.text();
  const parsed = parseJsonResponse(rawBody);

  if (!response.ok) {
    const error = parseMonnifyErrorMessage(parsed);
    log({
      level: "error",
      event: "monnify_response",
      merchantTxRef,
      method,
      path,
      statusCode: response.status,
      durationMs,
      error,
    });
    throw new MonnifyApiError(response.status, error);
  }

  log({
    level: "info",
    event: "monnify_response",
    merchantTxRef,
    method,
    path,
    statusCode: response.status,
    durationMs,
  });

  return parsed as T;
}
