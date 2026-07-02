export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { assertNombaWebhookConfigured } = await import("@/lib/nomba/env");
    assertNombaWebhookConfigured();
  }
}
