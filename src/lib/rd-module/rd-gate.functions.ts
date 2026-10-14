import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { rdOperator } from "./auth.functions";

export const rdGateStatus = createServerFn({ method: "GET" })
  .middleware([rdOperator])
  .handler(async ({ context }) => ({
    unlocked: true,
    isAdmin: true,
    member: context.rdOperator.email,
  }));

export const listTeamMembers = createServerFn({ method: "GET" })
  .middleware([rdOperator])
  .handler(async () => {
    const { supabaseAdmin } = await import("./supabase/client.server");
    const { data, error } = await supabaseAdmin
      .from("rd_team_members")
      .select("id,email,name,active,created_at,last_login_at")
      .order("created_at");
    if (error) throw new Error(`Could not load the R&D roster: ${error.message}`);
    return (data ?? []).map((member) => ({ ...member, hasPassword: false }));
  });

export const inviteTeamMember = createServerFn({ method: "POST" })
  .middleware([rdOperator])
  .inputValidator((input: unknown) =>
    z
      .object({
        email: z.string().trim().toLowerCase().email().max(200),
        name: z.string().trim().max(100),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("./supabase/client.server");
    const { error } = await supabaseAdmin
      .from("rd_team_members")
      .upsert({ ...data, active: true }, { onConflict: "email" });
    if (error) throw new Error(`Could not save the R&D roster member: ${error.message}`);
    return { code: "/login?redirect=%2Frd-manager" };
  });

export const setMemberActive = createServerFn({ method: "POST" })
  .middleware([rdOperator])
  .inputValidator((input: unknown) =>
    z
      .object({
        id: z.string().uuid(),
        active: z.boolean(),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("./supabase/client.server");
    const { error } = await supabaseAdmin
      .from("rd_team_members")
      .update({ active: data.active })
      .eq("id", data.id);
    if (error) throw new Error(`Could not update the R&D roster: ${error.message}`);
    return { ok: true };
  });
