import type { Partner, VaultDataState } from "./types";

export const QUORUM = 2;

export const SEED_PARTNERS: Partner[] = [
  { id: "mr", name: "M. Reeve", initials: "MR", phone: "+1 555 0140" },
  { id: "ah", name: "A. Halverson", initials: "AH", phone: "+1 555 0188" },
  { id: "ko", name: "K. Ortega", initials: "KO", phone: "+1 555 0162" },
];

export const FUNDING_ACCOUNT = "ACME-VLT-8841-0023-77";

export function getInitialVaultState(): VaultDataState {
  return {
    balanceCents: 0,
    fundingAccount: FUNDING_ACCOUNT,
    members: SEED_PARTNERS.map((p) => ({ ...p })),
    transactions: [],
    invitations: [],
    currentPartner: "mr",
  };
}
