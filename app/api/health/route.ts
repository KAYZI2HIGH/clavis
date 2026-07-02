import { getNombaWebhookSecret } from "@/lib/nomba/env";
import { getServiceClient } from "@/lib/supabase/service";

export const runtime = "nodejs";

type CheckStatus = "ok" | "not_configured" | "error";

type HealthResponse = {
  status: "ok" | "degraded";
  service: "clavis";
  version: string;
  timestamp: string;
  checks: {
    api: "ok";
    supabase: CheckStatus;
    nomba_webhook: CheckStatus;
  };
};

async function checkSupabase(): Promise<CheckStatus> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return "not_configured";

  try {
    const { error } = await getServiceClient()
      .from("vaults")
      .select("id", { count: "exact", head: true });

    return error ? "error" : "ok";
  } catch {
    return "error";
  }
}

function checkNombaWebhook(): CheckStatus {
  try {
    getNombaWebhookSecret();
    return "ok";
  } catch {
    return "error";
  }
}

async function buildHealth(): Promise<{
  body: HealthResponse;
  httpStatus: number;
}> {
  const [supabase, nombaWebhook] = await Promise.all([
    checkSupabase(),
    Promise.resolve(checkNombaWebhook()),
  ]);

  const checks = {
    api: "ok" as const,
    supabase,
    nomba_webhook: nombaWebhook,
  };

  const criticalFailure = supabase === "error";

  return {
    body: {
      status: criticalFailure ? "degraded" : "ok",
      service: "clavis",
      version: "0.1.0",
      timestamp: new Date().toISOString(),
      checks,
    },
    httpStatus: criticalFailure ? 503 : 200,
  };
}

export async function GET(request: Request) {
  const { body, httpStatus } = await buildHealth();

  const accept = request.headers.get("accept") ?? "";
  const wantsHtml = accept.includes("text/html");

  if (wantsHtml) {
    const isOk = body.status === "ok";
    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Clavis Health</title>
  <style>
    body { font-family: system-ui, sans-serif; display: grid; place-items: center; min-height: 100vh; margin: 0; background: #f6f3ed; color: #1a1a18; }
    .card { text-align: center; padding: 2.5rem 3rem; border: 1px solid #d8d2c8; border-radius: 6px; background: #fff; min-width: 280px; }
    .dot { width: 14px; height: 14px; border-radius: 999px; display: inline-block; margin-right: 8px; vertical-align: middle; background: ${isOk ? "#2f7d4a" : "#b45309"}; }
    h1 { font-size: 1.25rem; font-weight: 600; margin: 0 0 0.5rem; }
    p { margin: 0.25rem 0; color: #5c5a55; font-size: 0.95rem; }
    ul { list-style: none; padding: 0; margin: 1.25rem 0 0; text-align: left; font-size: 0.875rem; }
    li { padding: 0.35rem 0; border-top: 1px solid #ece7de; }
  </style>
</head>
<body>
  <div class="card">
    <h1><span class="dot"></span>${isOk ? "Healthy" : "Degraded"}</h1>
    <p>Clavis API</p>
    <ul>
      <li>API: ${body.checks.api}</li>
      <li>Supabase: ${body.checks.supabase}</li>
      <li>Nomba webhook: ${body.checks.nomba_webhook}</li>
    </ul>
  </div>
</body>
</html>`;

    return new Response(html, {
      status: httpStatus,
      headers: { "Content-Type": "text/html; charset=utf-8" },
    });
  }

  return Response.json(body, { status: httpStatus });
}

export async function HEAD() {
  const { httpStatus } = await buildHealth();
  return new Response(null, { status: httpStatus });
}
