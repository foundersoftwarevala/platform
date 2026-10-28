import { getRequestHeader } from "@tanstack/react-start/server";
import { userFromBearerToken, bearerToken } from "@/lib/auth/bearer-user.server";
import { withVpsPublicDatabase } from "@/lib/marketplace-manager/vps-rpc.server";

export async function requireVpsExecutive(): Promise<string> {
  const token = bearerToken(
    getRequestHeader("authorization") ?? getRequestHeader("Authorization"),
  );
  if (!token) throw new Error("Sign-in required");

  const user = await userFromBearerToken(token);
  if (!user) throw new Error("Sign-in required");

  const allowed = await withVpsPublicDatabase(async (tx) => {
    const [row] = await tx<{ allowed: boolean }[]>`
      select exists (
        select 1 from public.user_roles
         where user_id = ${user.id}::uuid
           and role::text in ('boss', 'admin', 'super_admin')
      ) as allowed
    `;
    return row?.allowed === true;
  });
  if (!allowed) throw new Error("Executive permission required");
  return user.id;
}
