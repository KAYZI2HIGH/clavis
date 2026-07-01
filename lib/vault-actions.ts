import { QUORUM, SEED_PARTNERS } from "./mock-data";
import type { Invitation, Transaction, VaultDataState } from "./types";

export type VaultAction =
  | { type: "FUND_VAULT" }
  | { type: "RESET_DEMO" }
  | {
      type: "REQUEST_PAYOUT";
      payload: {
        id: string;
        recipientName: string;
        recipientAccount: string;
        amount: number;
        memo: string;
        requestedBy: string;
      };
    }
  | { type: "TURN_KEY"; payload: { txId: string; partnerId: string } }
  | { type: "SETTLE_TX"; payload: { txId: string } }
  | {
      type: "DECLINE_TX";
      payload: { txId: string; partnerId: string; reason: string };
    }
  | {
      type: "CREATE_INVITE";
      payload: { placeholder: string; invitedBy: string; invitation: Invitation };
    }
  | { type: "ACCEPT_INVITE"; payload: { token: string } }
  | { type: "DECLINE_INVITE"; payload: { token: string } }
  | { type: "SET_ACTOR"; payload: { partnerId: string } }
  | { type: "UPDATE_MEMBER_NAME"; payload: { id: string; name: string } };

export function vaultReducer(
  state: VaultDataState,
  action: VaultAction,
): VaultDataState {
  switch (action.type) {
    case "FUND_VAULT":
      return {
        ...state,
        balanceCents:
          state.balanceCents === 0 ? 5_000_000 : state.balanceCents,
      };

    case "RESET_DEMO":
      return {
        balanceCents: 0,
        fundingAccount: state.fundingAccount,
        members: SEED_PARTNERS.map((p) => ({ ...p })),
        transactions: [],
        invitations: [],
        currentPartner: "mr",
      };

    case "REQUEST_PAYOUT": {
      const {
        id,
        recipientName,
        recipientAccount,
        amount,
        memo,
        requestedBy,
      } = action.payload;
      const tx: Transaction = {
        id,
        recipientName,
        recipientAccount,
        amount,
        memo,
        requestedBy,
        requestedAt: Date.now(),
        approvals: [requestedBy],
        status: "pending",
      };
      return { ...state, transactions: [tx, ...state.transactions] };
    }

    case "TURN_KEY": {
      const { txId, partnerId } = action.payload;
      const transactions = state.transactions.map((t) => {
        if (t.id !== txId) return t;
        if (t.approvals.includes(partnerId)) return t;
        const approvals = [...t.approvals, partnerId];
        const reachedQuorum = approvals.length >= QUORUM;
        return {
          ...t,
          approvals,
          status: reachedQuorum ? ("sealed" as const) : t.status,
          sealedAt: reachedQuorum ? Date.now() : t.sealedAt,
        };
      });
      return { ...state, transactions };
    }

    case "SETTLE_TX": {
      const { txId } = action.payload;
      const tx = state.transactions.find((t) => t.id === txId);
      if (!tx) return state;
      return {
        ...state,
        balanceCents: state.balanceCents - tx.amount,
        transactions: state.transactions.map((t) =>
          t.id === txId
            ? { ...t, status: "settled" as const, settledAt: Date.now() }
            : t,
        ),
      };
    }

    case "DECLINE_TX": {
      const { txId, partnerId, reason } = action.payload;
      return {
        ...state,
        transactions: state.transactions.map((t) =>
          t.id === txId
            ? {
                ...t,
                status: "declined" as const,
                declinedBy: partnerId,
                declineReason: reason,
              }
            : t,
        ),
      };
    }

    case "CREATE_INVITE": {
      const { invitation } = action.payload;
      return {
        ...state,
        invitations: [invitation, ...state.invitations],
      };
    }

    case "ACCEPT_INVITE":
      return {
        ...state,
        invitations: state.invitations.map((i) =>
          i.token === action.payload.token
            ? { ...i, status: "accepted" as const }
            : i,
        ),
      };

    case "DECLINE_INVITE":
      return {
        ...state,
        invitations: state.invitations.map((i) =>
          i.token === action.payload.token
            ? { ...i, status: "declined" as const }
            : i,
        ),
      };

    case "SET_ACTOR":
      return { ...state, currentPartner: action.payload.partnerId };

    case "UPDATE_MEMBER_NAME":
      return {
        ...state,
        members: state.members.map((m) =>
          m.id === action.payload.id
            ? { ...m, name: action.payload.name || m.name }
            : m,
        ),
      };

    default:
      return state;
  }
}

export function createInvitation(
  placeholder: string,
  invitedBy: string,
): Invitation {
  const token = Math.random().toString(36).slice(2, 10).toUpperCase();
  return {
    id: `INV-${token}`,
    token,
    placeholder: placeholder || "New partner",
    invitedBy,
    status: "pending",
    createdAt: Date.now(),
  };
}
