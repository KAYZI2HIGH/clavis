import { getAccessToken, getNombaApiBase } from "@/lib/nomba/client";
import { getNombaEnvironment } from "@/lib/nomba/env";
import { getServiceClient } from "@/lib/supabase/service";

export const runtime = "nodejs";

type HealthResponse = {
  status: "ok" | "degraded";
  timestamp: string;
  supabase: "connected" | "error";
  nomba: "authenticated" | "error";
  environment: "test" | "live";
  nombaEnv: string;
  nombaApiBase: string;
  nombaEnvVar: string;
};

async function checkSupabase(): Promise<"connected" | "error"> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return "error";

  try {
    const { error } = await getServiceClient()
      .from("vaults")
      .select("id", { count: "exact", head: true });

    return error ? "error" : "connected";
  } catch {
    return "error";
  }
}

async function checkNomba(): Promise<"authenticated" | "error"> {
  try {
    await getAccessToken();
    return "authenticated";
  } catch {
    return "error";
  }
}

async function buildHealth(): Promise<{
  body: HealthResponse;
  httpStatus: number;
}> {
  const [supabase, nomba] = await Promise.all([
    checkSupabase(),
    checkNomba(),
  ]);

  const body: HealthResponse = {
    status: supabase === "error" ? "degraded" : "ok",
    timestamp: new Date().toISOString(),
    supabase,
    nomba,
    environment: getNombaEnvironment(),
    nombaEnv: getNombaEnvironment(),
    nombaApiBase: getNombaApiBase(),
    nombaEnvVar: process.env.NOMBA_ENV ?? "not set",
  };

  return {
    body,
    httpStatus: supabase === "error" ? 503 : 200,
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
    li { padding: 0.35rem 0; border-top: 1px solid #ece7de; word-break: break-all; }
  </style>
</head>
<body>
  <div class="card">
    <h1><span class="dot"></span>${isOk ? "Healthy" : "Degraded"}</h1>
    <p>Clavis API · ${body.environment}</p>
    <ul>
      <li>Supabase: ${body.supabase}</li>
      <li>Nomba: ${body.nomba}</li>
      <li>nombaEnv: ${body.nombaEnv}</li>
      <li>nombaApiBase: ${body.nombaApiBase}</li>
      <li>nombaEnvVar: ${body.nombaEnvVar}</li>
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
