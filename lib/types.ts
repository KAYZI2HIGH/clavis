export type Stakeholder = {
  id: string;
  name: string;
  initials: string;
  email?: string;
  phone?: string;
  is_founder?: boolean;
  is_investor?: boolean;
  role?: "investor" | "operator";
  created_at?: string;
  // Legacy aliases for UI compat if needed
  isFounder?: boolean;
};

export type Partner = Stakeholder;

export type TxStatus = "pending" | "approved" | "executing" | "settled" | "failed" | "declined";

export type Transaction = {
  id: string;
  vault_id: string;
  requested_by: string;
  recipient_name?: string;
  recipient_account?: string;
  recipient_bank_code?: string;
  amount_kobo: number;
  memo?: string;
  narration?: string;
  status: TxStatus;
  required_quorum: number;
  monnify_tx_ref?: string;
  inflow_account_type?: "revenue" | "capital";
  is_inflow?: boolean;
  standing_order_id?: string;
  requested_at: string;
  settled_at?: string;
  declined_by?: string;
  decline_reason?: string;
  // UI joins
  approvals?: string[];
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

export type InvestmentType = "profit_share" | "fixed_return" | "hybrid";

export type Vault = {
  id: string;
  name: string;
  status: "draft" | "active" | "locked" | "closed";
  founder_id?: string;
  investor_id?: string;
  investment_type?: InvestmentType;
  investor_profit_share?: number;
  investor_monthly_fixed?: number;
  investor_return_cap?: number;
  term_duration_months?: number;
  settlement_day?: number;
  balance_kobo: number;
  revenue_account_number?: string;
  revenue_account_bank?: string;
  capital_account_number?: string;
  capital_account_bank?: string;
  total_invested_kobo: number;
  total_settled_kobo: number;
  quorum: number;
  created_at: string;
  updated_at: string;
  
  // Joins and legacy properties for UI compat
  stakeholders?: Stakeholder[];
  transactions?: Transaction[];
  linkInvitations?: LinkInvitation[];
  pendingJoins?: PendingJoin[];
  emailInvites?: EmailInvite[];
  youId?: string;
  founderId?: string;
  investorId?: string;
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
  vaultId?: string;
};

export type VaultAppState = {
  vaults: Vault[];
  activeVaultId: string | null;
  currentPartner: string;
  draft: Draft | null;
};

export type StandingOrderAction = 
  | "auto_execute"
  | "notify_then_execute"
  | "operator_quorum_only"
  | "always_require_investor";

export type StandingOrderCondition = {
  field: "amount" | "category" | "recipient" | "day_of_month";
  comparator: "less_than" | "greater_than" | "between" | "equals";
  value: number | string;
  value2?: number;
};

export type StandingOrder = {
  id: string;
  vault_id: string;
  proposed_by: string;
  status: "pending_approval" | "active" | "rejected" | "deleted";
  conditions: StandingOrderCondition[];
  action: StandingOrderAction;
  notify_window_hours?: number;
  plain_language: string;
  created_at: string;
  activated_at?: string;
};

export type InflowClassification = {
  id: string;
  vault_id: string;
  transaction_id: string;
  account_type: "revenue" | "capital";
  classification_method: 
    | "account_routing"
    | "narration_pattern"
    | "ai_pattern"
    | "investor_override";
  confidence: "high" | "medium" | "low";
  flagged_for_review: boolean;
  investor_reviewed: boolean;
  investor_decision?: "confirmed" | "reclassified";
  created_at: string;
};

export type Settlement = {
  id: string;
  vault_id: string;
  period_start: string;
  period_end: string;
  total_revenue_kobo: number;
  total_expenses_kobo: number;
  profit_pool_kobo: number;
  investor_share_kobo: number;
  investor_profit_share: number;
  status: "preview" | "processing" | "completed" | "failed" | "disputed";
  monnify_transfer_ref?: string;
  created_at: string;
  settled_at?: string;
};

export type Dispute = {
  id: string;
  vault_id: string;
  raised_by: string;
  dispute_type: 
    | "revenue_underreported"
    | "unauthorized_payment"
    | "settlement_error"
    | "standing_order_violated";
  related_transaction_id?: string;
  related_settlement_id?: string;
  ai_analysis?: Record<string, unknown>;
  status: "open" | "resolved" | "escalated";
  resolution?: string;
  created_at: string;
  resolved_at?: string;
};

export type InvestmentTerms = {
  investment_type: InvestmentType;
  investor_profit_share?: number;
  investor_monthly_fixed?: number;
  investor_return_cap?: number;
  term_duration_months?: number;
  settlement_day: number;
};
