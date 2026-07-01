import { RequireAuth } from "@/components/providers/require-auth";

export default function VaultLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <RequireAuth>{children}</RequireAuth>;
}
