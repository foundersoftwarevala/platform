export type WalletTransactionType = "credit" | "debit" | "fine" | "payout";

export type WalletDTO = {
  id: string;
  developer_id: string;
  balance_cents: string;
  currency: string;
  updated_at: string;
};

export type WalletTransactionDTO = {
  id: string;
  wallet_id: string;
  task_id: string | null;
  type: WalletTransactionType;
  amount_cents: string;
  reference: string | null;
  note: string | null;
  created_by: string;
  created_at: string;
};

export type DeveloperWalletSummaryDTO = {
  developer_id: string;
  email: string | null;
  wallet_id: string | null;
  balance_cents: string | null;
  currency: string | null;
  updated_at: string | null;
};

export type DueTaskPaymentDTO = {
  id: string;
  developer_id: string;
  developer_email: string | null;
  title: string;
  status: string;
  payment_status: string;
  amount_cents: string | null;
  due_at: Date | string | null;
  verified_at: Date | string | null;
};

export type TaskAmountResult = { taskId: string; amountCents: number };
