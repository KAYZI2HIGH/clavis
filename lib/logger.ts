export type LogEntry = {
  level: "info" | "warn" | "error";
  event: string;
  merchantTxRef?: string;
  vaultId?: string;
  [key: string]: unknown;
};

export function log(entry: LogEntry): void {
  console.log(
    JSON.stringify({
      ...entry,
      timestamp: new Date().toISOString(),
    }),
  );
}
