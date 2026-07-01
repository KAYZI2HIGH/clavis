"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useReducer,
  useRef,
  type ReactNode,
} from "react";
import { getInitialVaultState } from "@/lib/mock-data";
import type { LinkInvitation, Vault, VaultAppState } from "@/lib/types";
import {
  buildVaultFromDraft,
  createLinkInvitation,
  vaultReducer,
  type VaultAction,
} from "@/lib/vault-actions";
import {
  getActiveVault,
  makeId,
  makeInitials,
} from "@/lib/vault-utils";

type VaultContextValue = {
  state: VaultAppState;
  activeVault: Vault | null;
  openVault: (id: string) => void;
  leaveVault: () => void;
  startDraft: (founderName: string) => void;
  setDraftName: (name: string) => void;
  setDraftQuorum: (q: number) => void;
  setDraftMethod: (m: "link" | "email") => void;
  addDraftStakeholder: (name: string, email: string) => void;
  removeDraftStakeholder: (id: string) => void;
  foundVault: () => string;
  fundVault: () => void;
  resetDemo: () => void;
  requestPayout: (input: {
    recipientName: string;
    recipientAccount: string;
    amountKobo: number;
    memo: string;
  }) => string;
  turnKey: (txId: string, partnerId: string) => void;
  declineTx: (txId: string, partnerId: string, reason: string) => void;
  setQuorum: (n: number) => void;
  createLinkInvitation: () => LinkInvitation;
  acceptLinkInvitation: (token: string, joinerName: string, joinerId: string) => void;
  declineLinkInvitation: () => void;
  confirmPendingJoin: (joinId: string) => void;
  rejectPendingJoin: (joinId: string) => void;
  addEmailInviteToActive: (name: string, email: string) => void;
  setActor: (partnerId: string) => void;
};

const VaultContext = createContext<VaultContextValue | null>(null);

export function VaultProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(vaultReducer, undefined, () =>
    getInitialVaultState(),
  );
  const stateRef = useRef(state);
  stateRef.current = state;

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
    (id: string) => dispatchAction({ type: "OPEN_VAULT", payload: { vaultId: id } }),
    [dispatchAction],
  );

  const leaveVault = useCallback(
    () => dispatchAction({ type: "LEAVE_VAULT" }),
    [dispatchAction],
  );

  const startDraft = useCallback(
    (founderName: string) =>
      dispatchAction({ type: "START_DRAFT", payload: { founderName } }),
    [dispatchAction],
  );

  const setDraftName = useCallback(
    (name: string) => dispatchAction({ type: "SET_DRAFT_NAME", payload: { name } }),
    [dispatchAction],
  );

  const setDraftQuorum = useCallback(
    (q: number) => dispatchAction({ type: "SET_DRAFT_QUORUM", payload: { quorum: q } }),
    [dispatchAction],
  );

  const setDraftMethod = useCallback(
    (m: "link" | "email") =>
      dispatchAction({ type: "SET_DRAFT_METHOD", payload: { method: m } }),
    [dispatchAction],
  );

  const addDraftStakeholder = useCallback(
    (name: string, email: string) =>
      dispatchAction({ type: "ADD_DRAFT_STAKEHOLDER", payload: { name, email } }),
    [dispatchAction],
  );

  const removeDraftStakeholder = useCallback(
    (id: string) =>
      dispatchAction({ type: "REMOVE_DRAFT_STAKEHOLDER", payload: { id } }),
    [dispatchAction],
  );

  const foundVault = useCallback(() => {
    const draft = stateRef.current.draft;
    if (!draft) return "";
    const vault = buildVaultFromDraft(draft);
    dispatchAction({ type: "FOUND_VAULT", payload: { vault } });
    return vault.id;
  }, [dispatchAction]);

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
    (n: number) => dispatchAction({ type: "SET_QUORUM", payload: { quorum: n } }),
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
      startDraft,
      setDraftName,
      setDraftQuorum,
      setDraftMethod,
      addDraftStakeholder,
      removeDraftStakeholder,
      foundVault,
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
      setActor,
    }),
    [
      state,
      activeVault,
      openVault,
      leaveVault,
      startDraft,
      setDraftName,
      setDraftQuorum,
      setDraftMethod,
      addDraftStakeholder,
      removeDraftStakeholder,
      foundVault,
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
      setActor,
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
