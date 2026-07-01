export type Partner = {
  id: string;
  name: string;
  initials: string;
  phone?: string;
};

export type TxStatus = "pending" | "sealed" | "settled" | "declined";

export type Transaction = {
  id: string;
  recipientName: string;
  recipientAccount: string;
  amount: number;
  memo: string;
  requestedBy: string;
  requestedAt: number;
  approvals: string[];
  status: TxStatus;
  sealedAt?: number;
  settledAt?: number;
  declinedBy?: string;
  declineReason?: string;
};

export type Invitation = {
  id: string;
  token: string;
  placeholder: string;
  invitedBy: string;
  status: "pending" | "accepted" | "declined";
  createdAt: number;
};

export type VaultDataState = {
  balanceCents: number;
  fundingAccount: string;
  members: Partner[];
  transactions: Transaction[];
  invitations: Invitation[];
  currentPartner: string;
};
