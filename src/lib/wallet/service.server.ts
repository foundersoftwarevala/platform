import type { TaskTransaction } from "@/lib/tasks/db.server";

export type DeveloperWallet = {
  id: string;
  developer_id: string;
  balance_cents: string;
  currency: string;
  updated_at: Date | string;
};

export type DeveloperWalletTransaction = {
  id: string;
  wallet_id: string;
  task_id: string | null;
  type: "credit" | "debit" | "fine" | "payout";
  amount_cents: string;
  reference: string | null;
  note: string | null;
  created_by: string;
  created_at: Date | string;
};

export async function getOrCreateDeveloperWalletForFinance(
  tx: TaskTransaction,
  developerId: string,
): Promise<DeveloperWallet> {
  const [created] = await tx<DeveloperWallet[]>`
    insert into public.developer_wallets (developer_id)
    values (${developerId}::uuid)
    on conflict (developer_id) do nothing
    returning *
  `;
  if (created) return created;

  const [existing] = await tx<DeveloperWallet[]>`
    select * from public.developer_wallets
     where developer_id = ${developerId}::uuid
  `;
  if (!existing) throw new Error("Developer wallet creation did not return a wallet.");
  return existing;
}

async function assertDeveloperAccount(
  tx: TaskTransaction,
  developerId: string,
): Promise<void> {
  const roles = await tx<{ role: string }[]>`
    select role::text as role
      from public.user_roles
     where user_id = ${developerId}::uuid
  `;
  if (!roles.some((row) => row.role === "developer")) {
    throw new Error("Wallet transactions can be recorded only for developer accounts.");
  }
}

// PHASE5-WALLET: wallet credit and task payment share the caller's transaction.
export async function creditPaidTask(
  tx: TaskTransaction,
  actorId: string,
  taskId: string,
  developerId: string,
  amountCents: number | string | bigint,
  reference: string,
  note: string,
): Promise<void> {
  const amount = BigInt(amountCents);
  if (amount <= 0n) throw new Error("Set a positive task amount before marking it paid.");

  await assertDeveloperAccount(tx, developerId);
  const wallet = await getOrCreateDeveloperWalletForFinance(tx, developerId);
  const [inserted] = await tx<{ id: string }[]>`
    insert into public.developer_wallet_transactions (
      wallet_id, task_id, type, amount_cents, reference, note, created_by
    ) values (
      ${wallet.id}::uuid, ${taskId}::uuid, 'credit', ${amount.toString()}::bigint,
      ${reference}, ${note}, ${actorId}::uuid
    )
    on conflict (task_id) where task_id is not null and type = 'credit'
    do nothing
    returning id
  `;

  if (inserted) return;

  const [existing] = await tx<{ amount_cents: string; wallet_id: string }[]>`
    select amount_cents::text, wallet_id
      from public.developer_wallet_transactions
     where task_id = ${taskId}::uuid AND type = 'credit'
  `;
  if (
    !existing ||
    BigInt(existing.amount_cents) !== amount ||
    existing.wallet_id !== wallet.id
  ) {
    throw new Error("Task already has a conflicting wallet credit.");
  }
}

export async function recordWalletTransaction(
  tx: TaskTransaction,
  input: {
    developerId: string;
    actorId: string;
    type: "debit" | "fine" | "payout";
    amountCents: number;
    reference: string | null;
    note: string | null;
  },
): Promise<DeveloperWalletTransaction> {
  if (!Number.isSafeInteger(input.amountCents) || input.amountCents <= 0) {
    throw new Error("Wallet amount must be a positive whole number of cents.");
  }
  await assertDeveloperAccount(tx, input.developerId);
  const wallet = await getOrCreateDeveloperWalletForFinance(tx, input.developerId);
  const [row] = await tx<DeveloperWalletTransaction[]>`
    insert into public.developer_wallet_transactions (
      wallet_id, type, amount_cents, reference, note, created_by
    ) values (
      ${wallet.id}::uuid, ${input.type}, ${input.amountCents}::bigint,
      ${input.reference}, ${input.note}, ${input.actorId}::uuid
    )
    returning *
  `;
  if (!row) throw new Error("Wallet transaction insert returned no row.");
  return row;
}
