"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { InputStyles } from "@/components/shared/input-styles";
import { KeyIcon } from "@/components/shared/key-icon";
import { Wordmark } from "@/components/shared/wordmark";
import { useSession, signOut } from "next-auth/react";
import { useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query-keys";
import { useVaultsQuery } from "@/hooks/use-vaults-query";
import { VaultListSkeleton } from "@/components/vault/vault-list-skeleton";
import { saveDraft } from "@/lib/draft";
import { makeId, makeInitials } from "@/lib/vault-utils";
import type { Stakeholder, Vault } from "@/lib/types";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export function HomeScreen() {
  const { data: session } = useSession();
  const { data: vaultsData, isLoading } = useVaultsQuery();
  const vaults = (vaultsData?.vaults ?? []) as Array<Vault>;
  const qc = useQueryClient();
  const router = useRouter();
  const [pasted, setPasted] = useState("");
  const [hoveredVaultId, setHoveredVaultId] = useState<string | null>(null);
  const [showActionsOnMobile, setShowActionsOnMobile] = useState(false);
  const [pendingVaultAction, setPendingVaultAction] = useState<{
    vaultId: string;
    vaultName: string;
    kind: "delete" | "leave";
  } | null>(null);

  useEffect(() => {
    const mediaQuery = window.matchMedia("(hover: none), (pointer: coarse)");
    const update = () => setShowActionsOnMobile(mediaQuery.matches);
    update();
    mediaQuery.addEventListener("change", update);
    return () => mediaQuery.removeEventListener("change", update);
  }, []);

  const submitPaste = () => {
    const m =
      pasted.match(/join=([A-Z0-9]+)/i) ||
      pasted.match(/[?&]token=([A-Z0-9]+)/i);
    if (!m) return;
    router.push(`/join-vault?token=${m[1]}`);
  };

  const handleSignOut = () => {
    void signOut({ redirectTo: "/" });
  };

  const handleCreateVault = () => {
    router.push("/vault/create/name");
  };

  const handleOpenVault = (id: string) => {
    router.push(`/vault/${id}`);
  };

  const handleDeleteVault = async (vaultId: string) => {
    // TODO: Batch 5 — wire to DELETE /api/vaults/[vaultId]
    toast.info("Delete vault coming soon");
  };

  const handleLeaveVault = async (vaultId: string) => {
    // TODO: Batch 5 — wire to POST /api/vaults/[vaultId]/leave
    toast.info("Leave vault coming soon");
  };

  const handleDiscard = async (vaultId: string) => {
    const res = await fetch(`/api/vaults/${vaultId}/draft`, { method: "DELETE" });
    if (res.ok) {
      qc.invalidateQueries({ queryKey: queryKeys.vaults.all });
      toast.success("Draft vault discarded");
    } else {
      toast.error("Failed to discard vault");
    }
  };

  const confirmVaultAction = () => {
    if (!pendingVaultAction) return;

    if (pendingVaultAction.kind === "delete") {
      // If it's a draft vault, we discard it
      const v = vaults?.find((vault) => vault.id === pendingVaultAction.vaultId);
      if (v?.status === "draft") {
        handleDiscard(pendingVaultAction.vaultId);
      } else {
        handleDeleteVault(pendingVaultAction.vaultId);
      }
    } else {
      handleLeaveVault(pendingVaultAction.vaultId);
    }

    setPendingVaultAction(null);
  };

  const isVaultFounder = (vaultId: string) => {
    const v = vaults?.find((vault) => vault.id === vaultId);
    return v?.founderId === v?.youId || v?.investorId === v?.youId;
  };

  const isFounderOfVault = (vault: { stakeholders?: Stakeholder[] }) => {
    return vault.stakeholders?.some(
      (s) => s.email === session?.user?.email && s.isFounder
    );
  };

  // Sort vaults dynamically so recently added or updated are at the top (reversed)
  const activeVaults = (vaults ?? [])
    .filter((v) => v.status !== "draft")
    .sort((a, b) => new Date(b.updated_at || 0).getTime() - new Date(a.updated_at || 0).getTime());
  const draftVaults = (vaults ?? [])
    .filter((v) => v.status === "draft")
    .sort((a, b) => new Date(b.updated_at || 0).getTime() - new Date(a.updated_at || 0).getTime());

  const handleResumeDraft = (v: { id: string }) => {
    router.push(`/vault/create/${v.id}/invite`);
  };

  return (
    <div className="min-h-screen bg-paper grain flex flex-col">
      <header className="px-4 sm:px-8 py-6 flex items-center justify-between border-b hairline">
        <Wordmark size="sm" />
        <div className="flex items-center gap-2 sm:gap-4 min-w-0">
          <p className="engraved text-ink-faint truncate hidden sm:block">
            Signed in as {session?.user?.name ?? "you"}
          </p>
          <button
            className="engraved text-ink-faint hover:text-ink transition-colors"
            onClick={handleSignOut}
          >
            Sign out
          </button>
        </div>
      </header>
      <main className="flex-1 flex items-start justify-center px-4 sm:px-8 py-16">
        <div className="max-w-2xl w-full">
          <p className="engraved">Your vaults</p>
          <h1 className="serif text-3xl text-ink mt-2 leading-tight">
            Which vault would you like to open?
          </h1>
          <div className="mt-10">
            {isLoading ? (
              <VaultListSkeleton />
            ) : !vaults || vaults.length === 0 ? (
              <div className="border hairline-strong bg-card px-6 py-8 text-center">
                <p className="text-sm text-ink-muted">
                  You don&apos;t hold a key to any vault yet.
                </p>
              </div>
            ) : (
              <div className="border hairline-strong bg-card divide-y hairline">
                {activeVaults.map((v) => (
                  <div
                    key={v.id}
                    role="button"
                    tabIndex={0}
                    onClick={() => handleOpenVault(v.id)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        handleOpenVault(v.id);
                      }
                    }}
                    onMouseEnter={() => setHoveredVaultId(v.id)}
                    onMouseLeave={() =>
                      setHoveredVaultId((current) =>
                        current === v.id ? null : current,
                      )
                    }
                    className="w-full flex items-center justify-between px-6 py-5 text-left hover:bg-secondary/60 transition-colors"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="serif text-xl text-ink">{v.name}</p>
                        <span className="text-[10px] uppercase tracking-widest text-ink-faint bg-ink/5 px-2 py-0.5 rounded-sm">
                          {v.investorId === v.youId ? "Investor" : "Operator"}
                        </span>
                      </div>
                      <p className="engraved mt-1">
                        Requires {v.quorum} of {v.stakeholders?.length ?? 0} keys
                      </p>
                    </div>
                    <div className="flex items-center gap-1.5">
                      {v.stakeholders?.map((s) => (
                        <KeyIcon
                          key={s.id}
                          filled
                        />
                      ))}
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <button
                            type="button"
                            aria-label={`Vault actions for ${v.name}`}
                            onClick={(event) => event.stopPropagation()}
                            style={{
                              opacity:
                                showActionsOnMobile || hoveredVaultId === v.id ?
                                  1
                                : 0,
                              pointerEvents:
                                showActionsOnMobile || hoveredVaultId === v.id ?
                                  "auto"
                                : "none",
                              background: "transparent",
                              border: 0,
                              color: "var(--ink-muted)",
                              padding: 0,
                              marginLeft: 2,
                              transition:
                                "opacity 140ms ease, color 140ms ease",
                              fontSize: 20,
                              lineHeight: 1,
                            }}
                            onMouseEnter={() => setHoveredVaultId(v.id)}
                            onMouseLeave={() =>
                              setHoveredVaultId((current) =>
                                current === v.id ? null : current,
                              )
                            }
                            className="hover:text-ink focus:text-ink focus:outline-none cursor-pointer"
                          >
                            ⋯
                          </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent
                          align="end"
                          sideOffset={8}
                        >
                          <DropdownMenuItem
                            onSelect={() => handleOpenVault(v.id)}
                          >
                            Open Vault
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            onSelect={() =>
                              setPendingVaultAction({
                                vaultId: v.id,
                                vaultName: v.name,
                                kind: isVaultFounder(v.id) ? "delete" : "leave",
                              })
                            }
                            className="text-crimson focus:text-crimson"
                          >
                            {isVaultFounder(v.id) ?
                              "Delete Vault"
                            : "Leave Vault"}
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Draft Vaults Section */}
          {draftVaults.length > 0 && (
            <div className="mt-12">
              <p className="engraved">Pending Setup</p>
              <h2 className="serif text-xl text-ink mt-1">Draft vaults in progress</h2>
              <div className="mt-4 border hairline-strong bg-card divide-y hairline">
                {draftVaults.map((v) => (
                  <div
                    key={v.id}
                    className="w-full flex items-center justify-between px-6 py-4"
                  >
                    <div>
                      <p className="serif text-lg text-ink">{v.name}</p>
                      <p className="engraved mt-0.5 text-ink-faint">
                        Draft · {v.stakeholders?.length ?? 0} partner(s) joined
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      {isFounderOfVault(v) ? (
                        <>
                          <button
                            className="btn-mech btn-mech-ghost py-1.5 px-3 text-xs"
                            onClick={() => handleResumeDraft(v)}
                          >
                            Resume Setup
                          </button>
                          <button
                            className="btn-mech btn-mech-ghost py-1.5 px-3 text-xs text-crimson"
                            onClick={() =>
                              setPendingVaultAction({
                                vaultId: v.id,
                                vaultName: v.name,
                                kind: "delete",
                              })
                            }
                          >
                            Discard
                          </button>
                        </>
                      ) : (
                        <p className="text-xs text-ink-muted">
                          Waiting for founder to complete setup
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="mt-10 grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="border hairline-strong bg-card p-5">
              <p className="engraved">Found a new vault</p>
              <p className="serif text-lg text-ink mt-1 leading-snug">
                Start one as the founding partner.
              </p>
              <button
                className="btn-mech btn-mech-ghost w-full mt-4"
                onClick={handleCreateVault}
              >
                Create Investment
              </button>
            </div>
            <div className="border hairline-strong bg-card p-5">
              <p className="engraved">Have an invite link?</p>
              <p className="serif text-lg text-ink mt-1 leading-snug">
                Paste it to review the invitation.
              </p>
              <div className="mt-4 flex gap-2">
                <input
                  className="input-mech mono flex-1"
                  value={pasted}
                  onChange={(e) => setPasted(e.target.value)}
                  placeholder="…/join-vault?token=ABCD1234"
                />
                <button
                  className="btn-mech btn-mech-ghost"
                  onClick={submitPaste}
                  disabled={!pasted.trim()}
                >
                  Open
                </button>
              </div>
            </div>
          </div>
        </div>
      </main>
      <AlertDialog
        open={!!pendingVaultAction}
        onOpenChange={(open) => {
          if (!open) setPendingVaultAction(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {pendingVaultAction?.kind === "delete" ?
                "Delete this vault?"
              : "Leave this vault?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {pendingVaultAction?.kind === "delete" ?
                "This will permanently close the vault and remove access for all partners. This cannot be undone."
              : "You will lose access to this vault and its funds. The remaining partners will retain control."
              }
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="btn-mech btn-mech-ghost">
              {pendingVaultAction?.kind === "delete" ? "Keep Vault" : "Stay"}
            </AlertDialogCancel>
            <AlertDialogAction
              className="btn-mech btn-mech-danger"
              onClick={confirmVaultAction}
            >
              {pendingVaultAction?.kind === "delete" ?
                "Delete Vault"
              : "Leave Vault"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <InputStyles />
    </div>
  );
}
