import postgres, { type Sql, type TransactionSql } from "postgres";
import { deploymentSetting } from "@/lib/seo/seo-store.server";

const PLATFORM_DATABASE = "sv_platform";
const CHAT_MANAGER_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

let pool: Sql | undefined;

function platformDatabaseUrl(): string {
  const explicit =
    deploymentSetting("SV_PLATFORM_DATABASE_URL") || deploymentSetting("I18N_DATABASE_URL");
  const configured = explicit || deploymentSetting("VPS_DATABASE_URL");
  if (!configured) throw new Error("The canonical platform database is not configured.");

  const url = new URL(configured);
  if (!["postgres:", "postgresql:"].includes(url.protocol)) {
    throw new Error("The canonical platform database must use PostgreSQL.");
  }
  if (explicit && decodeURIComponent(url.pathname.slice(1)) !== PLATFORM_DATABASE) {
    throw new Error("The Chat Manager database must be the canonical sv_platform database.");
  }
  if (!explicit) url.pathname = `/${PLATFORM_DATABASE}`;
  return url.toString();
}

async function database(): Promise<Sql> {
  if (pool) return pool;
  pool = postgres(platformDatabaseUrl(), {
    max: 4,
    idle_timeout: 30,
    connect_timeout: 10,
    connection: { statement_timeout: 30_000, application_name: "sv-chat-manager" },
    onnotice: () => {},
  });
  return pool;
}

export type ChatManagerTransaction = TransactionSql;

/**
 * One transaction on sv_platform as the trusted server. The connection's own
 * login holds no Chat privileges; the transaction takes the service role for
 * its duration only (the same role the server's service key reaches through
 * PostgREST). Who may do what is decided by the callers below and by the
 * database's own SECURITY DEFINER functions, against the verified user.
 */
export async function withChatPlatformDatabase<T>(
  run: (tx: ChatManagerTransaction) => Promise<T>,
): Promise<Awaited<T>> {
  const sql = await database();
  const result = await sql.begin(async (tx) => {
    await tx`set local role service_role`;
    return { value: await run(tx) };
  });
  return result.value;
}

/** Accounts already known to exist in sv_platform, so the mirror runs once per process. */
const mirrored = new Set<string>();

export async function withChatIdentity<T>(
  userId: string,
  run: (tx: ChatManagerTransaction) => Promise<T>,
  email?: string | null,
): Promise<Awaited<T>> {
  if (!CHAT_MANAGER_UUID.test(userId)) throw new Error("A valid signed-in user is required.");
  return withChatPlatformDatabase(async (tx) => {
    // Sign-in is hosted and Chat data lives here: an account that signed up
    // since the move is recorded once, from the server-verified token.
    if (!mirrored.has(userId)) {
      await tx`select public.chat_mirror_auth_user(${userId}::uuid, ${email ?? null})`;
      mirrored.add(userId);
    }
    await tx`select public.chat_ensure_account(${userId}::uuid)`;
    await tx`select set_config('request.jwt.claim.sub', ${userId}, true)`;
    return run(tx);
  });
}

export async function withChatManagerIdentity<T>(
  userId: string,
  permission: string,
  run: (tx: ChatManagerTransaction) => Promise<T>,
): Promise<Awaited<T>> {
  return withChatIdentity(userId, async (tx) => {
    const [authorization] = await tx<{ allowed: boolean }[]>`
      select public.has_permission(${userId}::uuid, ${permission}) as allowed
    `;
    if (!authorization?.allowed) {
      throw new Error(
        `You do not have permission to ${permission === "chat.manage" ? "manage chat" : "perform this chat operation"}.`,
      );
    }
    return run(tx);
  });
}

export async function getChatManagerAccess(userId: string): Promise<{
  canManageChat: boolean;
  canManagePermissions: boolean;
  permissions: string[];
}> {
  if (!CHAT_MANAGER_UUID.test(userId)) throw new Error("A valid signed-in user is required.");
  const [access] = await withChatPlatformDatabase(
    (sql) => sql<
      {
        can_manage_chat: boolean;
        can_manage_permissions: boolean;
        can_assign: boolean;
        can_moderate: boolean;
        can_export: boolean;
        can_send: boolean;
      }[]
    >`
    select public.has_permission(${userId}::uuid, 'chat.manage') as can_manage_chat,
           public.has_permission(${userId}::uuid, 'chat.permissions.manage') as can_manage_permissions,
           public.has_permission(${userId}::uuid, 'chat.assign') as can_assign,
           public.has_permission(${userId}::uuid, 'chat.moderate') as can_moderate,
           public.has_permission(${userId}::uuid, 'chat.export') as can_export,
           public.has_permission(${userId}::uuid, 'message.send') as can_send
  `,
  );
  if (!access) throw new Error("Could not verify Chat Manager access.");
  return {
    canManageChat: access.can_manage_chat,
    canManagePermissions: access.can_manage_permissions,
    permissions: [
      access.can_manage_chat && "chat.manage",
      access.can_manage_permissions && "chat.permissions.manage",
      access.can_assign && "chat.assign",
      access.can_moderate && "chat.moderate",
      access.can_export && "chat.export",
      // The operator reply needs it too; the server checks it again on send.
      access.can_send && "message.send",
    ].filter((permission): permission is string => typeof permission === "string"),
  };
}
