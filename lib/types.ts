export type Stakeholder = {
  id: string;
  name: string;
  initials: string;
  email?: string;
  phone?: string;
  isFounder?: boolean;
};

/** Backwards-compat alias — Partner === Stakeholder for the active vault. */
export type Partner = Stakeholder;

export type TxStatus = "pending" | "sealed" | "executing" | "settled" | "declined" | "failed";

export type Transaction = {
  id: string;
  vaultId: string;
  recipientName: string;
  recipientAccount: string;
  recipientBankCode: string;
  recipientBankName: string;
  amountKobo: number;
  memo: string;
  requestedBy: string;
  requestedAt: number;
  approvals: string[];
  status: TxStatus;
  requiredQuorum: number;
  sealedAt?: number;
  settledAt?: number;
  declinedBy?: string;
  declineReason?: string;
};

export type LinkInvitation = {
  id: string;
  token: string;
  placeholder: string;
  invitedBy: string;
  status: "pending" | "accepted" | "declined";
  createdAt: number;
};

/** @deprecated Use LinkInvitation */
export type Invitation = LinkInvitation;

export type PendingJoin = {
  id: string;
  vaultId: string;
  name: string;
  initials: string;
  viaToken: string;
  requestedAt: number;
};

export type EmailInvite = {
  id: string;
  name: string;
  email: string;
  initials: string;
  invitedBy: string;
  createdAt: number;
  status: "pending" | "accepted";
};

export type Vault = {
  id: string;
  name: string;
  quorum: number;
  stakeholders: Stakeholder[];
  youId: string;
  founderId: string;
  balanceKobo: number;
  fundingAccount: string;
  transactions: Transaction[];
  linkInvitations: LinkInvitation[];
  pendingJoins: PendingJoin[];
  emailInvites: EmailInvite[];
  status: "draft" | "active";
  nombaVirtualAccountBank?: string;
  updatedAt?: number;
};

export type DraftStakeholder = {
  id: string;
  name: string;
  email?: string;
  initials: string;
  isFounder?: boolean;
};

export type Draft = {
  name: string;
  quorum: number;
  method: "link" | "email";
  stakeholders: DraftStakeholder[];
  linkToken?: string;
  /** Set after the vault is eagerly created in the DB at the name step */
  vaultId?: string;
};

export type VaultAppState = {
  vaults: Vault[];
  activeVaultId: string | null;
  currentPartner: string;
  draft: Draft | null;
};
