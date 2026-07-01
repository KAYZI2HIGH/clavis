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
import { getInitialVaultState, QUORUM } from "@/lib/mock-data";
import type { Invitation, VaultDataState } from "@/lib/types";
import {
  createInvitation,
  vaultReducer,
  type VaultAction,
} from "@/lib/vault-actions";

type VaultContextValue = {
  state: VaultDataState;
  fundVault: () => void;
  resetDemo: () => void;
  requestPayout: (input: {
    recipientName: string;
    recipientAccount: string;
    amount: number;
    memo: string;
  }) => string;
  turnKey: (txId: string, partnerId: string) => void;
  declineTx: (txId: string, partnerId: string, reason: string) => void;
  createInvite: (placeholder: string) => Invitation;
  acceptInvite: (token: string) => void;
  declineInvite: (token: string) => void;
  setActor: (partnerId: string) => void;
  updateMemberName: (id: string, name: string) => void;
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
      const tx = stateRef.current.transactions.find((t) => t.id === txId);
      if (tx && tx.status === "sealed" && !tx.settledAt) {
        dispatch({ type: "SETTLE_TX", payload: { txId } });
      }
    }, 2200);
  }, []);

  const fundVault = useCallback(() => {
    dispatchAction({ type: "FUND_VAULT" });
  }, [dispatchAction]);

  const resetDemo = useCallback(() => {
    dispatchAction({ type: "RESET_DEMO" });
  }, [dispatchAction]);

  const requestPayout = useCallback(
    (input: {
      recipientName: string;
      recipientAccount: string;
      amount: number;
      memo: string;
    }) => {
      const requestedBy = stateRef.current.currentPartner;
      const id = `TX-${Math.floor(1000 + Math.random() * 9000)}`;
      dispatchAction({
        type: "REQUEST_PAYOUT",
        payload: { ...input, requestedBy, id },
      });
      return id;
    },
    [dispatchAction],
  );

  const turnKey = useCallback(
    (txId: string, partnerId: string) => {
      const txBefore = stateRef.current.transactions.find((t) => t.id === txId);
      if (!txBefore || txBefore.approvals.includes(partnerId)) return;

      const approvalsAfter = [...txBefore.approvals, partnerId];
      const willSeal =
        txBefore.status === "pending" && approvalsAfter.length >= QUORUM;

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

  const createInvite = useCallback(
    (placeholder: string) => {
      const invitedBy = stateRef.current.currentPartner;
      const invitation = createInvitation(placeholder, invitedBy);
      dispatchAction({
        type: "CREATE_INVITE",
        payload: { placeholder, invitedBy, invitation },
      });
      return invitation;
    },
    [dispatchAction],
  );

  const acceptInvite = useCallback(
    (token: string) => {
      dispatchAction({ type: "ACCEPT_INVITE", payload: { token } });
    },
    [dispatchAction],
  );

  const declineInvite = useCallback(
    (token: string) => {
      dispatchAction({ type: "DECLINE_INVITE", payload: { token } });
    },
    [dispatchAction],
  );

  const setActor = useCallback(
    (partnerId: string) => {
      dispatchAction({ type: "SET_ACTOR", payload: { partnerId } });
    },
    [dispatchAction],
  );

  const updateMemberName = useCallback(
    (id: string, name: string) => {
      dispatchAction({ type: "UPDATE_MEMBER_NAME", payload: { id, name } });
    },
    [dispatchAction],
  );

  const value = useMemo(
    () => ({
      state,
      fundVault,
      resetDemo,
      requestPayout,
      turnKey,
      declineTx,
      createInvite,
      acceptInvite,
      declineInvite,
      setActor,
      updateMemberName,
    }),
    [
      state,
      fundVault,
      resetDemo,
      requestPayout,
      turnKey,
      declineTx,
      createInvite,
      acceptInvite,
      declineInvite,
      setActor,
      updateMemberName,
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
