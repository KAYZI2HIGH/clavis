"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useSession } from "next-auth/react";
import { getInitialVaultState } from "@/lib/mock-data";
import type { LinkInvitation, Vault, VaultAppState } from "@/lib/types";
import {
  buildVaultFromDraft,
  createLinkInvitation,
  vaultReducer,
  type VaultAction,
} from "@/lib/vault-actions";
import { getActiveVault, makeId, makeInitials } from "@/lib/vault-utils";

type VaultContextValue = {
  state: VaultAppState;
  activeVault: Vault | null;
  openVault: (id: string) => void;
  leaveVault: () => void;
  removeVault: (vaultId: string) => void;
  startDraft: (founderName: string) => void;
  setDraftName: (name: string) => void;
  setDraftQuorum: (q: number) => void;
  setDraftMethod: (m: "link" | "email") => void;
  addDraftStakeholder: (name: string, email: string) => void;
  removeDraftStakeholder: (id: string) => void;
  foundVault: (vault?: Vault) => string;
  setDraftVaultId: (vaultId: string, linkToken: string) => void;
  resumeDraft: (vault: Vault) => void;
  fundVault: () => void;
  resetDemo: () => void;
  requestPayout: (input: {
    recipientName: string;
    recipientAccount: string;
    recipientBankCode: string;
    recipientBankName: string;
    amountKobo: number;
    memo: string;
  }) => string;
  turnKey: (txId: string, partnerId: string) => void;
  declineTx: (txId: string, partnerId: string, reason: string) => void;
  setQuorum: (n: number) => void;
  createLinkInvitation: () => LinkInvitation;
  acceptLinkInvitation: (
    token: string,
    joinerName: string,
    joinerId: string,
  ) => void;
  declineLinkInvitation: () => void;
  confirmPendingJoin: (joinId: string) => void;
  rejectPendingJoin: (joinId: string) => void;
  addEmailInviteToActive: (name: string, email: string) => void;
  updateVaultFundingAccount: (vaultId: string, accountNumber: string, bankName: string) => void;
  reloadVaults: () => Promise<void>;
  setActor: (partnerId: string) => void;
  loading: boolean;
};

const VaultContext = createContext<VaultContextValue | null>(null);

export function VaultProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(vaultReducer, undefined, () =>
    getInitialVaultState(),
  );
  const stateRef = useRef(state);
  stateRef.current = state;

  const [loading, setLoading] = useState(true);
  const { data: session, status } = useSession();

  const loadVaults = useCallback(async () => {
    try {
      const res = await fetch("/api/vaults");
      if (!res.ok) throw new Error("Failed to fetch vaults");
      const data = await res.json();
      dispatch({
        type: "HYDRATE_VAULTS",
        payload: { vaults: data.vaults },
      });
    } catch (err) {
      console.error("Failed to load vaults from DB:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (status !== "authenticated") {
      if (status === "unauthenticated") {
        setLoading(false);
      }
      return;
    }

    loadVaults();
  }, [status, loadVaults]);

  const dispatchAction = useCallback((action: VaultAction) => {
    dispatch(action);
  }, []);

  const scheduleSettlement = useCallback((txId: string) => {
    setTimeout(() => {
      const vault = stateRef.current.vaults.find((v) =>
        v.transactions.some((t) => t.id === txId),
      );
      const tx = vault?.transactions.find((t) => t.id === txId);
      if (tx && tx.status === "sealed" && !tx.settledAt) {
        dispatch({ type: "SETTLE_TX", payload: { txId } });
      }
    }, 2200);
  }, []);

  const openVault = useCallback(
    (id: string) =>
      dispatchAction({ type: "OPEN_VAULT", payload: { vaultId: id } }),
    [dispatchAction],
  );

  const leaveVault = useCallback(
    () => dispatchAction({ type: "LEAVE_VAULT" }),
    [dispatchAction],
  );

  const removeVault = useCallback(
    (vaultId: string) =>
      dispatchAction({ type: "REMOVE_VAULT", payload: { vaultId } }),
    [dispatchAction],
  );

  const startDraft = useCallback(
    (founderName: string) =>
      dispatchAction({ type: "START_DRAFT", payload: { founderName } }),
    [dispatchAction],
  );

  const setDraftName = useCallback(
    (name: string) =>
      dispatchAction({ type: "SET_DRAFT_NAME", payload: { name } }),
    [dispatchAction],
  );

  const setDraftQuorum = useCallback(
    (q: number) =>
      dispatchAction({ type: "SET_DRAFT_QUORUM", payload: { quorum: q } }),
    [dispatchAction],
  );

  const setDraftMethod = useCallback(
    (m: "link" | "email") =>
      dispatchAction({ type: "SET_DRAFT_METHOD", payload: { method: m } }),
    [dispatchAction],
  );

  const addDraftStakeholder = useCallback(
    (name: string, email: string) =>
      dispatchAction({
        type: "ADD_DRAFT_STAKEHOLDER",
        payload: { name, email },
      }),
    [dispatchAction],
  );

  const removeDraftStakeholder = useCallback(
    (id: string) =>
      dispatchAction({ type: "REMOVE_DRAFT_STAKEHOLDER", payload: { id } }),
    [dispatchAction],
  );

  const setDraftVaultId = useCallback(
    (vaultId: string, linkToken: string) =>
      dispatchAction({ type: "SET_DRAFT_VAULT_ID", payload: { vaultId, linkToken } }),
    [dispatchAction],
  );

  const resumeDraft = useCallback(
    (vault: Vault) =>
      dispatchAction({ type: "RESUME_DRAFT", payload: { vault } }),
    [dispatchAction],
  );

  const foundVault = useCallback(
    (vault?: Vault) => {
      const draft = stateRef.current.draft;
      if (!vault && !draft) return "";
      const finalVault = vault ?? buildVaultFromDraft(draft!);
      dispatchAction({ type: "FOUND_VAULT", payload: { vault: finalVault } });
      return finalVault.id;
    },
    [dispatchAction],
  );

  const fundVault = useCallback(
    () => dispatchAction({ type: "FUND_VAULT" }),
    [dispatchAction],
  );

  const resetDemo = useCallback(
    () => dispatchAction({ type: "RESET_DEMO" }),
    [dispatchAction],
  );

  const requestPayout = useCallback(
    (input: {
      recipientName: string;
      recipientAccount: string;
      recipientBankCode: string;
      recipientBankName: string;
      amountKobo: number;
      memo: string;
    }) => {
      const s = stateRef.current;
      const active = getActiveVault(s.vaults, s.activeVaultId);
      if (!active) return "";
      const id = `TX-${Math.floor(1000 + Math.random() * 9000)}`;
      dispatchAction({
        type: "REQUEST_PAYOUT",
        payload: { ...input, requestedBy: s.currentPartner, id },
      });
      return id;
    },
    [dispatchAction],
  );

  const turnKey = useCallback(
    (txId: string, partnerId: string) => {
      const s = stateRef.current;
      const active = getActiveVault(s.vaults, s.activeVaultId);
      if (!active) return;
      const txBefore = active.transactions.find((t) => t.id === txId);
      if (!txBefore || txBefore.approvals.includes(partnerId)) return;

      const approvalsAfter = [...txBefore.approvals, partnerId];
      const willSeal =
        txBefore.status === "pending" &&
        approvalsAfter.length >= txBefore.requiredQuorum;

      dispatchAction({ type: "TURN_KEY", payload: { txId, partnerId } });

      if (willSeal) {
        scheduleSettlement(txId);
      }
    },
    [dispatchAction, scheduleSettlement],
  );

  const declineTx = useCallback(
    (txId: string, partnerId: string, reason: string) => {
      dispatchAction({
        type: "DECLINE_TX",
        payload: { txId, partnerId, reason },
      });
    },
    [dispatchAction],
  );

  const setQuorum = useCallback(
    (n: number) =>
      dispatchAction({ type: "SET_QUORUM", payload: { quorum: n } }),
    [dispatchAction],
  );

  const createLinkInvite = useCallback(() => {
    const invitedBy = stateRef.current.currentPartner;
    const invitation = createLinkInvitation(invitedBy);
    dispatchAction({ type: "CREATE_LINK_INVITATION", payload: { invitation } });
    return invitation;
  }, [dispatchAction]);

  const acceptLinkInvitation = useCallback(
    (token: string, joinerName: string, joinerId: string) => {
      const targetVault = stateRef.current.vaults.find((v) =>
        v.linkInvitations.some((i) => i.token === token),
      );
      if (!targetVault) return;
      const pj = {
        id: makeId("pj"),
        vaultId: targetVault.id,
        name: joinerName,
        initials: makeInitials(joinerName),
        viaToken: token,
        requestedAt: Date.now(),
      };
      dispatchAction({
        type: "ACCEPT_LINK_INVITATION",
        payload: { token, pendingJoin: pj },
      });
      void joinerId;
    },
    [dispatchAction],
  );

  const declineLinkInvitation = useCallback(
    () => dispatchAction({ type: "DECLINE_LINK_INVITATION" }),
    [dispatchAction],
  );

  const confirmPendingJoin = useCallback(
    (joinId: string) => {
      const active = getActiveVault(
        stateRef.current.vaults,
        stateRef.current.activeVaultId,
      );
      const pj = active?.pendingJoins.find((p) => p.id === joinId);
      if (!pj) return;
      const stakeholder = {
        id: makeId("sh"),
        name: pj.name,
        initials: pj.initials,
      };
      dispatchAction({
        type: "CONFIRM_PENDING_JOIN",
        payload: { joinId, stakeholder },
      });
    },
    [dispatchAction],
  );

  const rejectPendingJoin = useCallback(
    (joinId: string) =>
      dispatchAction({ type: "REJECT_PENDING_JOIN", payload: { joinId } }),
    [dispatchAction],
  );

  const addEmailInviteToActive = useCallback(
    (name: string, email: string) => {
      const invitedBy = stateRef.current.currentPartner;
      const invite = {
        id: makeId("inv"),
        name,
        email,
        initials: makeInitials(name),
        invitedBy,
        createdAt: Date.now(),
        status: "pending" as const,
      };
      const stakeholder = {
        id: makeId("sh"),
        name,
        initials: makeInitials(name),
        email,
      };
      dispatchAction({
        type: "ADD_EMAIL_INVITE",
        payload: { invite, stakeholder },
      });
    },
    [dispatchAction],
  );

  const updateVaultFundingAccount = useCallback(
    (vaultId: string, accountNumber: string, bankName: string) => {
      dispatchAction({
        type: "UPDATE_VAULT_FUNDING_ACCOUNT",
        payload: { vaultId, accountNumber, bankName },
      });
    },
    [dispatchAction],
  );

  const setActor = useCallback(
    (partnerId: string) =>
      dispatchAction({ type: "SET_ACTOR", payload: { partnerId } }),
    [dispatchAction],
  );

  const activeVault = useMemo(
    () => getActiveVault(state.vaults, state.activeVaultId),
    [state.vaults, state.activeVaultId],
  );

  const value = useMemo(
    () => ({
      state,
      activeVault,
      openVault,
      leaveVault,
      removeVault,
      startDraft,
      setDraftName,
      setDraftQuorum,
      setDraftMethod,
      addDraftStakeholder,
      removeDraftStakeholder,
      foundVault,
      setDraftVaultId,
      resumeDraft,
      fundVault,
      resetDemo,
      requestPayout,
      turnKey,
      declineTx,
      setQuorum,
      createLinkInvitation: createLinkInvite,
      acceptLinkInvitation,
      declineLinkInvitation,
      confirmPendingJoin,
      rejectPendingJoin,
      addEmailInviteToActive,
      updateVaultFundingAccount,
      reloadVaults: loadVaults,
      setActor,
      loading,
    }),
    [
      state,
      activeVault,
      openVault,
      leaveVault,
      removeVault,
      startDraft,
      setDraftName,
      setDraftQuorum,
      setDraftMethod,
      addDraftStakeholder,
      removeDraftStakeholder,
      foundVault,
      setDraftVaultId,
      resumeDraft,
      fundVault,
      resetDemo,
      requestPayout,
      turnKey,
      declineTx,
      setQuorum,
      createLinkInvite,
      acceptLinkInvitation,
      declineLinkInvitation,
      confirmPendingJoin,
      rejectPendingJoin,
      addEmailInviteToActive,
      updateVaultFundingAccount,
      loadVaults,
      setActor,
      loading,
    ],
  );

  return (
    <VaultContext.Provider value={value}>{children}</VaultContext.Provider>
  );
}

export function useVaultContext() {
  const ctx = useContext(VaultContext);
  if (!ctx) {
    throw new Error("useVaultContext must be used within VaultProvider");
  }
  return ctx;
}
