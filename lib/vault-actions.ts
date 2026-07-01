import {
  getActiveVault,
  makeFundingAccount,
  makeId,
  makeInitials,
  updateActiveVault,
} from "./vault-utils";
import type {
  Draft,
  DraftStakeholder,
  EmailInvite,
  LinkInvitation,
  PendingJoin,
  Stakeholder,
  Transaction,
  Vault,
  VaultAppState,
} from "./types";

export type VaultAction =
  | { type: "RESET_DEMO" }
  | { type: "SET_ACTOR"; payload: { partnerId: string } }
  | { type: "OPEN_VAULT"; payload: { vaultId: string } }
  | { type: "LEAVE_VAULT" }
  | { type: "START_DRAFT"; payload: { founderName: string } }
  | { type: "SET_DRAFT_NAME"; payload: { name: string } }
  | { type: "SET_DRAFT_QUORUM"; payload: { quorum: number } }
  | { type: "SET_DRAFT_METHOD"; payload: { method: "link" | "email" } }
  | { type: "SET_DRAFT_LINK_TOKEN"; payload: { token: string } }
  | {
      type: "ADD_DRAFT_STAKEHOLDER";
      payload: { name: string; email: string };
    }
  | { type: "REMOVE_DRAFT_STAKEHOLDER"; payload: { id: string } }
  | { type: "FOUND_VAULT"; payload: { vault: Vault } }
  | { type: "FUND_VAULT" }
  | {
      type: "REQUEST_PAYOUT";
      payload: {
        id: string;
        recipientName: string;
        recipientAccount: string;
        amountKobo: number;
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
  | { type: "SET_QUORUM"; payload: { quorum: number } }
  | {
      type: "CREATE_LINK_INVITATION";
      payload: { invitation: LinkInvitation };
    }
  | {
      type: "ACCEPT_LINK_INVITATION";
      payload: { token: string; pendingJoin: PendingJoin };
    }
  | { type: "DECLINE_LINK_INVITATION" }
  | { type: "CONFIRM_PENDING_JOIN"; payload: { joinId: string; stakeholder: Stakeholder } }
  | { type: "REJECT_PENDING_JOIN"; payload: { joinId: string } }
  | {
      type: "ADD_EMAIL_INVITE";
      payload: { invite: EmailInvite; stakeholder: Stakeholder };
    };

export function createLinkInvitation(invitedBy: string): LinkInvitation {
  const token = Math.random().toString(36).slice(2, 10).toUpperCase();
  return {
    id: `INV-${token}`,
    token,
    placeholder: "New partner",
    invitedBy,
    status: "pending",
    createdAt: Date.now(),
  };
}

export function buildVaultFromDraft(draft: Draft): Vault {
  const vaultId = makeId("v");
  const stakeholders: Stakeholder[] = draft.stakeholders.map((sh) => ({
    id: sh.id,
    name: sh.name,
    initials: sh.initials,
    email: sh.email,
    isFounder: sh.isFounder,
  }));
  const founder = stakeholders.find((s) => s.isFounder)!;
  const quorum = Math.min(Math.max(1, draft.quorum), stakeholders.length);

  const emailInvites: EmailInvite[] =
    draft.method === "email"
      ? stakeholders
          .filter((s) => !s.isFounder)
          .map((s) => ({
            id: makeId("inv"),
            name: s.name,
            email: s.email ?? "",
            initials: s.initials,
            invitedBy: founder.id,
            createdAt: Date.now(),
            status: "pending" as const,
          }))
      : [];

  const linkInvitations: LinkInvitation[] = [];
  if (draft.method === "link" && draft.linkToken) {
    linkInvitations.push({
      id: `INV-${draft.linkToken}`,
      token: draft.linkToken,
      placeholder: "New partner",
      invitedBy: founder.id,
      status: "pending",
      createdAt: Date.now(),
    });
  }

  return {
    id: vaultId,
    name: draft.name.trim() || "Untitled Vault",
    quorum,
    stakeholders,
    youId: founder.id,
    founderId: founder.id,
    balanceKobo: 0,
    fundingAccount: makeFundingAccount(),
    transactions: [],
    linkInvitations,
    pendingJoins: [],
    emailInvites,
  };
}

export function vaultReducer(
  state: VaultAppState,
  action: VaultAction,
): VaultAppState {
  switch (action.type) {
    case "RESET_DEMO":
      return {
        vaults: [],
        activeVaultId: null,
        currentPartner: "",
        draft: null,
      };

    case "SET_ACTOR":
      return { ...state, currentPartner: action.payload.partnerId };

    case "OPEN_VAULT": {
      const v = state.vaults.find((x) => x.id === action.payload.vaultId);
      if (!v) return state;
      return {
        ...state,
        activeVaultId: v.id,
        currentPartner: v.youId,
      };
    }

    case "LEAVE_VAULT":
      return { ...state, activeVaultId: null, currentPartner: "" };

    case "START_DRAFT": {
      const name = action.payload.founderName || "You";
      const founder: DraftStakeholder = {
        id: makeId("sh"),
        name,
        initials: makeInitials(name),
        isFounder: true,
      };
      const linkToken = Math.random().toString(36).slice(2, 10).toUpperCase();
      return {
        ...state,
        draft: {
          name: "",
          quorum: 2,
          method: "link",
          stakeholders: [founder],
          linkToken,
        },
      };
    }

    case "SET_DRAFT_NAME":
      return state.draft
        ? { ...state, draft: { ...state.draft, name: action.payload.name } }
        : state;

    case "SET_DRAFT_QUORUM":
      return state.draft
        ? { ...state, draft: { ...state.draft, quorum: action.payload.quorum } }
        : state;

    case "SET_DRAFT_METHOD":
      return state.draft
        ? { ...state, draft: { ...state.draft, method: action.payload.method } }
        : state;

    case "SET_DRAFT_LINK_TOKEN":
      return state.draft
        ? {
            ...state,
            draft: { ...state.draft, linkToken: action.payload.token },
          }
        : state;

    case "ADD_DRAFT_STAKEHOLDER": {
      if (!state.draft) return state;
      const { name, email } = action.payload;
      if (!name.trim() || !email.trim()) return state;
      const sh: DraftStakeholder = {
        id: makeId("sh"),
        name: name.trim(),
        email: email.trim(),
        initials: makeInitials(name),
      };
      return {
        ...state,
        draft: {
          ...state.draft,
          stakeholders: [...state.draft.stakeholders, sh],
        },
      };
    }

    case "REMOVE_DRAFT_STAKEHOLDER":
      if (!state.draft) return state;
      return {
        ...state,
        draft: {
          ...state.draft,
          stakeholders: state.draft.stakeholders.filter(
            (sh) => sh.id !== action.payload.id || sh.isFounder,
          ),
        },
      };

    case "FOUND_VAULT": {
      const vault = action.payload.vault;
      return {
        ...state,
        vaults: [...state.vaults, vault],
        activeVaultId: vault.id,
        currentPartner: vault.youId,
        draft: null,
      };
    }

    case "FUND_VAULT":
      return {
        ...state,
        vaults: updateActiveVault(state.vaults, state.activeVaultId, (v) => ({
          ...v,
          balanceKobo: v.balanceKobo === 0 ? 5_000_000 : v.balanceKobo,
        })),
      };

    case "REQUEST_PAYOUT": {
      const active = getActiveVault(state.vaults, state.activeVaultId);
      if (!active) return state;
      const {
        id,
        recipientName,
        recipientAccount,
        amountKobo,
        memo,
        requestedBy,
      } = action.payload;
      const tx: Transaction = {
        id,
        vaultId: active.id,
        recipientName,
        recipientAccount,
        amountKobo,
        memo,
        requestedBy,
        requestedAt: Date.now(),
        approvals: [requestedBy],
        status: "pending",
        requiredQuorum: active.quorum,
      };
      return {
        ...state,
        vaults: updateActiveVault(state.vaults, state.activeVaultId, (v) => ({
          ...v,
          transactions: [tx, ...v.transactions],
        })),
      };
    }

    case "TURN_KEY":
      return {
        ...state,
        vaults: updateActiveVault(state.vaults, state.activeVaultId, (v) => ({
          ...v,
          transactions: v.transactions.map((t) => {
            if (t.id !== action.payload.txId) return t;
            if (t.approvals.includes(action.payload.partnerId)) return t;
            const approvals = [...t.approvals, action.payload.partnerId];
            const reached = approvals.length >= t.requiredQuorum;
            return {
              ...t,
              approvals,
              status: reached ? ("sealed" as const) : t.status,
              sealedAt: reached ? Date.now() : t.sealedAt,
            };
          }),
        })),
      };

    case "SETTLE_TX": {
      const { txId } = action.payload;
      return {
        ...state,
        vaults: state.vaults.map((v) => {
          const tx = v.transactions.find((t) => t.id === txId);
          if (!tx || tx.status !== "sealed" || tx.settledAt) return v;
          return {
            ...v,
            balanceKobo: v.balanceKobo - tx.amountKobo,
            transactions: v.transactions.map((t) =>
              t.id === txId
                ? { ...t, status: "settled" as const, settledAt: Date.now() }
                : t,
            ),
          };
        }),
      };
    }

    case "DECLINE_TX":
      return {
        ...state,
        vaults: updateActiveVault(state.vaults, state.activeVaultId, (v) => ({
          ...v,
          transactions: v.transactions.map((t) =>
            t.id === action.payload.txId
              ? {
                  ...t,
                  status: "declined" as const,
                  declinedBy: action.payload.partnerId,
                  declineReason: action.payload.reason,
                }
              : t,
          ),
        })),
      };

    case "SET_QUORUM":
      return {
        ...state,
        vaults: updateActiveVault(state.vaults, state.activeVaultId, (v) => ({
          ...v,
          quorum: Math.min(
            Math.max(1, action.payload.quorum),
            v.stakeholders.length,
          ),
        })),
      };

    case "CREATE_LINK_INVITATION":
      return {
        ...state,
        vaults: updateActiveVault(state.vaults, state.activeVaultId, (v) => ({
          ...v,
          linkInvitations: [
            action.payload.invitation,
            ...v.linkInvitations,
          ],
        })),
      };

    case "ACCEPT_LINK_INVITATION": {
      const { pendingJoin } = action.payload;
      return {
        ...state,
        vaults: state.vaults.map((v) =>
          v.id === pendingJoin.vaultId
            ? { ...v, pendingJoins: [pendingJoin, ...v.pendingJoins] }
            : v,
        ),
      };
    }

    case "DECLINE_LINK_INVITATION":
      return state;

    case "CONFIRM_PENDING_JOIN":
      return {
        ...state,
        vaults: updateActiveVault(state.vaults, state.activeVaultId, (v) => ({
          ...v,
          stakeholders: [...v.stakeholders, action.payload.stakeholder],
          pendingJoins: v.pendingJoins.filter(
            (p) => p.id !== action.payload.joinId,
          ),
        })),
      };

    case "REJECT_PENDING_JOIN":
      return {
        ...state,
        vaults: updateActiveVault(state.vaults, state.activeVaultId, (v) => ({
          ...v,
          pendingJoins: v.pendingJoins.filter(
            (p) => p.id !== action.payload.joinId,
          ),
        })),
      };

    case "ADD_EMAIL_INVITE":
      return {
        ...state,
        vaults: updateActiveVault(state.vaults, state.activeVaultId, (v) => ({
          ...v,
          emailInvites: [action.payload.invite, ...v.emailInvites],
          stakeholders: [...v.stakeholders, action.payload.stakeholder],
        })),
      };

    default:
      return state;
  }
}
