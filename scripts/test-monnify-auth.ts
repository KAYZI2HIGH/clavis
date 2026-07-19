/**
 * Test script: Monnify authentication
 *
 * Docs source: https://developers.monnify.com/docs/
 * Confirmed endpoint: POST /api/v1/auth/login
 * Auth: Basic base64(apiKey:secretKey)
 * Token lives in: response.responseBody.accessToken
 * Token TTL: 1 hour
 *
 * Run with: npx tsx scripts/test-monnify-auth.ts
 */

const MONNIFY_SANDBOX_BASE = "https://sandbox.monnify.com";

async function testMonnifyAuth() {
  // Step 1 — Read credentials from environment
  const apiKey = process.env.MONNIFY_API_KEY;
  const secretKey = process.env.MONNIFY_SECRET_KEY;

  if (!apiKey || !secretKey) {
    console.error(
      "❌ Missing env vars. Set MONNIFY_API_KEY and MONNIFY_SECRET_KEY before running."
    );
    process.exit(1);
  }

  // Step 2 — Base64 encode apiKey:secretKey
  const credentials = Buffer.from(`${apiKey}:${secretKey}`).toString("base64");
  console.log("✅ Credentials encoded (not logged for security)");

  // Step 3 — POST to the Monnify auth endpoint
  //   Endpoint confirmed from docs: POST /api/v1/auth/login
  //   Auth: Authorization: Basic <base64(apiKey:secretKey)>
  //   No request body required
  const url = `${MONNIFY_SANDBOX_BASE}/api/v1/auth/login`;
  console.log(`\n📡 POSTing to: ${url}`);

  let response: Response;
  try {
    response = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Basic ${credentials}`,
        "Content-Type": "application/json",
      },
    });
  } catch (err) {
    console.error("❌ Network error:", err);
    process.exit(1);
  }

  // Step 4 — Log the full response
  const rawBody = await response.text();
  console.log(`\n📥 HTTP Status: ${response.status} ${response.statusText}`);
  console.log("📥 Response Headers:");
  response.headers.forEach((value, key) => {
    console.log(`   ${key}: ${value}`);
  });

  let parsed: unknown;
  try {
    parsed = JSON.parse(rawBody);
    console.log("\n📥 Response Body (parsed):");
    console.log(JSON.stringify(parsed, null, 2));
  } catch {
    console.log("\n📥 Response Body (raw):");
    console.log(rawBody);
    console.error("❌ Response was not valid JSON");
    process.exit(1);
  }

  // Step 5 — Confirm an access token was returned
  //   Monnify wraps the token in: response.responseBody.accessToken
  const body = parsed as Record<string, unknown>;
  const responseBody = body?.responseBody as Record<string, unknown> | undefined;
  const accessToken = responseBody?.accessToken;

  if (!accessToken || typeof accessToken !== "string") {
    console.error(
      "\n❌ FAILED: No accessToken found in responseBody.accessToken"
    );
    console.error("   requestSuccessful:", body?.requestSuccessful);
    console.error("   responseCode:", body?.responseCode);
    console.error("   responseMessage:", body?.responseMessage);
    process.exit(1);
  }

  // Show a truncated token for confirmation (never log full tokens)
  const tokenPreview = `${accessToken.slice(0, 20)}…${accessToken.slice(-8)}`;
  console.log(`\n✅ SUCCESS — Access token received: ${tokenPreview}`);
  console.log(`   Expires in: ${(responseBody?.expiresIn as number) ?? "~3600"} seconds`);
  console.log("\n🎉 Monnify authentication is working correctly.");
}

testMonnifyAuth().catch((err) => {
  console.error("Unhandled error:", err);
  process.exit(1);
});
