"use client";

import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { queryKeys } from "@/lib/query-keys";
import { formatNGN } from "@/lib/format";
import { log } from "@/lib/logger";

export function useVaultRealtime(vaultId: string | null) {
  const qc = useQueryClient();

  useEffect(() => {
    if (!vaultId) return;

    const supabase = getSupabaseBrowserClient();

    const channel = supabase
      .channel(`vault:${vaultId}`)

      // Subscribe to vault balance changes
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "vaults",
        },
        (payload) => {
          if (payload.new.id !== vaultId) return;

          const newBalance = payload.new.balance_kobo as number;
          const currentVault = qc.getQueryData<import("@/lib/types").Vault>(queryKeys.vaults.detail(vaultId));
          const oldBalance = currentVault?.balance_kobo ?? 0;

          // Eagerly update the cache with the new database row
          qc.setQueryData<import("@/lib/types").Vault>(
            queryKeys.vaults.detail(vaultId),
            (old) => {
              if (!old) return old;
              return {
                ...old,
                balance_kobo: newBalance,
                total_invested_kobo: payload.new.total_invested_kobo ?? old.total_invested_kobo,
                total_settled_kobo: payload.new.total_settled_kobo ?? old.total_settled_kobo,
                quorum: payload.new.quorum ?? old.quorum,
                status: payload.new.status ?? old.status,
              };
            }
          );

          // Still invalidate just in case there are nested relation updates
          setTimeout(() => {
            qc.invalidateQueries({
              queryKey: queryKeys.vaults.detail(vaultId),
            });
            qc.invalidateQueries({
              queryKey: queryKeys.vaults.all,
            });
          }, 1500);

          // Only show toast if balance increased 
          // (incoming fund, not a deduction)
          if (newBalance > oldBalance) {
            const diff = newBalance - oldBalance;
            toast.success(
              `${formatNGN(diff)} received — vault funded.`,
              {
                duration: 6000,
                description: "Vault balance has been updated.",
              }
            );
          }
        }
      )

      // Subscribe to new transactions
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "transactions",
        },
        (payload) => {
          if (payload.new.vault_id !== vaultId) return;

          // Add delay for read replica catchup
          setTimeout(() => {
            qc.invalidateQueries({
              queryKey: queryKeys.vaults.detail(vaultId),
            });
            qc.invalidateQueries({
              queryKey: queryKeys.vaults.all,
            });
            qc.invalidateQueries({
              queryKey: queryKeys.vaults.transactions(vaultId),
            });
          }, 1500);

          const status = payload.new.status as string;
          const narration = payload.new.narration as string;

          if (
            status === "settled" &&
            narration === "Vault funded"
          ) {
            return;
          }
        }
      )

      // Subscribe to transaction status updates
      // (transfer.success and transfer.failed webhook outcomes)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "transactions",
        },
        (payload) => {
          if (payload.new.vault_id !== vaultId) return;

          const newStatus = payload.new.status as string;
          const oldStatus = payload.old.status as string;

          // Only react to meaningful status transitions
          if (newStatus === oldStatus) return;

          setTimeout(() => {
            qc.invalidateQueries({
              queryKey: queryKeys.vaults.detail(vaultId),
            });
            qc.invalidateQueries({
              queryKey: queryKeys.vaults.all,
            });
            qc.invalidateQueries({
              queryKey: queryKeys.vaults.transactions(vaultId),
            });
          }, 1500);

          if (newStatus === "settled" && oldStatus === "executing") {
            toast.success("Payout settled.", {
              duration: 5000,
              description: `Transfer completed successfully.`,
            });
          }

          if (newStatus === "failed" && (oldStatus === "executing" || oldStatus === "pending")) {
            toast.error("Payout failed.", {
              duration: 8000,
              description:
                "The transfer failed. Vault balance has been refunded.",
            });
          }
        }
      )

      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "stakeholders",
        },
        (payload) => {
          if (payload.new.vault_id !== vaultId) return;

          setTimeout(() => {
            qc.invalidateQueries({
              queryKey: queryKeys.vaults.detail(vaultId),
            });
          }, 1500);
        }
      )

      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "transaction_approvals",
        },
        () => {
          setTimeout(() => {
            qc.invalidateQueries({
              queryKey: queryKeys.vaults.detail(vaultId),
            });
          }, 1500);
        }
      )

      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "reconciliation_logs",
        },
        (payload) => {
          if (payload.new.vault_id !== vaultId) return;
          
          qc.invalidateQueries({ 
            queryKey: ["reconciliation", vaultId] 
          });
        }
      )

      .subscribe((status) => {
        if (status === "SUBSCRIBED") {
          log({
            level: "info",
            event: "realtime_subscribed",
            vaultId,
          });
        }
        if (status === "CHANNEL_ERROR") {
          log({
            level: "error",
            event: "realtime_channel_error",
            vaultId,
          });
        }
      });

    // Cleanup subscription on unmount or vaultId change
    return () => {
      supabase.removeChannel(channel);
    };
  }, [vaultId, qc]);
}
