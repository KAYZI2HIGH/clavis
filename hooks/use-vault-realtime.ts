"use client";

import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { queryKeys } from "@/lib/query-keys";
import { formatNGN } from "@/lib/format";
import { useVault } from "@/hooks/use-vault";

export function useVaultRealtime(vaultId: string | null) {
  const qc = useQueryClient();
  const { reloadVaults } = useVault();

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
          const oldBalance = payload.old.balance_kobo as number;

          // Invalidate vault query so dashboard refetches
          qc.invalidateQueries({
            queryKey: queryKeys.vaults.detail(vaultId),
          });
          qc.invalidateQueries({
            queryKey: queryKeys.vaults.all,
          });

          // Sync local context provider reducer state
          reloadVaults();

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

          // Invalidate transactions query
          qc.invalidateQueries({
            queryKey: queryKeys.vaults.detail(vaultId),
          });
          qc.invalidateQueries({
            queryKey: queryKeys.vaults.all,
          });
          qc.invalidateQueries({
            queryKey: queryKeys.vaults.transactions(vaultId),
          });

          // Sync local context provider reducer state
          reloadVaults();

          const status = payload.new.status as string;
          const narration = payload.new.narration as string;

          if (
            status === "settled" &&
            narration === "Vault funded"
          ) {
            // Balance toast already shown above via vault UPDATE
            // No duplicate toast here
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

          qc.invalidateQueries({
            queryKey: queryKeys.vaults.detail(vaultId),
          });
          qc.invalidateQueries({
            queryKey: queryKeys.vaults.all,
          });
          qc.invalidateQueries({
            queryKey: queryKeys.vaults.transactions(vaultId),
          });

          // Sync local context provider reducer state
          reloadVaults();

          if (newStatus === "settled" && oldStatus === "executing") {
            toast.success("Payout settled.", {
              duration: 5000,
              description: `Transfer completed successfully.`,
            });
          }

          if (newStatus === "failed" && oldStatus === "executing") {
            toast.error("Payout failed.", {
              duration: 8000,
              description:
                "The transfer was reversed. Vault balance has been refunded.",
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

          // Sync local context provider reducer state so member list updates
          reloadVaults();
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

          // Sync local context provider reducer state
          reloadVaults();
        }
      )

      .subscribe((status) => {
        if (status === "SUBSCRIBED") {
          console.log(`[realtime] subscribed to vault:${vaultId}`);
        }
        if (status === "CHANNEL_ERROR") {
          console.error(
            `[realtime] channel error for vault:${vaultId}`
          );
        }
      });

    // Cleanup subscription on unmount or vaultId change
    return () => {
      supabase.removeChannel(channel);
    };
  }, [vaultId, qc, reloadVaults]);
}
