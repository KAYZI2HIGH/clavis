export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { assertMonnifyConfigured } = await import("@/lib/monnify/env");
    assertMonnifyConfigured();
  }
}
