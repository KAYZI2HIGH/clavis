import { RequireAuth } from "@/components/providers/require-auth";

export default function AuthenticatedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <RequireAuth>{children}</RequireAuth>;
}
