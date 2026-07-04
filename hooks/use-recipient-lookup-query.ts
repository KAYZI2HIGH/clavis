import { useQuery } from "@tanstack/react-query";

export function useRecipientLookupQuery(
  accountNumber: string,
  bankCode: string
) {
  return useQuery({
    queryKey: ["recipient-lookup", accountNumber, bankCode],
    queryFn: async () => {
      const res = await fetch("/api/transfers/lookup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accountNumber, bankCode }),
      });
      if (!res.ok) throw new Error("Account not found");
      return res.json() as Promise<{ accountName: string }>;
    },
    enabled: accountNumber.length === 10 && bankCode.length > 0,
    retry: false,
    staleTime: 1000 * 60 * 5,  // cache for 5 minutes
  });
}
