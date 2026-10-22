import { createServerFn } from "@tanstack/react-start";
import { getRequestHeader } from "@tanstack/react-start/server";
import { z } from "zod";
import type { TaskTransaction } from "@/lib/tasks/db.server";

const MANAGER_ROLES = new Set([
  "admin",
  "boss",
  "boss_owner",
  "founder",
  "super_admin",
  "sales_support_manager",
  "finance_manager",
]);

type WorkspaceRole = "sales" | "support" | "manager";

type Actor = {
  id: string;
  roles: Set<string>;
  isManager: boolean;
  teamMemberId: string | null;
};

type TeamMemberDTO = {
  id: string;
  fullName: string;
  department: string;
  roleTitle: string;
  authUserId: string | null;
  email: string | null;
};

type AccountOptionDTO = {
  id: string;
  fullName: string;
  email: string | null;
  role: "sales" | "support";
};

type LeadDTO = {
  id: string;
  reference: string;
  company: string;
  contactName: string;
  email: string | null;
  phone: string | null;
  stage: string;
  value: string;
  assignedTo: string | null;
  createdAt: string;
};

type DealDTO = {
  id: string;
  reference: string;
  title: string;
  leadId: string | null;
  stage: string;
  value: string;
  probability: number;
  ownerId: string | null;
  createdAt: string;
};

type QuoteDTO = {
  id: string;
  reference: string;
  dealId: string;
  ownerId: string;
  title: string;
  amount: string;
  status: string;
  createdAt: string;
};

type TicketDTO = {
  id: string;
  reference: string;
  subject: string;
  description: string | null;
  customerName: string;
  category: string;
  priority: string;
  status: string;
  assignedTo: string | null;
  createdAt: string;
};

type ReplyDTO = {
  id: string;
  ticketId: string;
  actorId: string;
  body: string;
  createdAt: string;
};

async function withActor<T>(
  role: WorkspaceRole,
  operation: (tx: TaskTransaction, actor: Actor) => Promise<T>,
): Promise<T> {
  const authorization = getRequestHeader("authorization") ?? getRequestHeader("Authorization");
  const token = authorization?.startsWith("Bearer ") ? authorization.slice(7) : null;
  if (!token) throw new Error("Unauthorized: sign in required.");

  const { userFromBearerToken } = await import("@/lib/auth/bearer-user.server");
  const caller = await userFromBearerToken(token);
  if (!caller) throw new Error("Unauthorized: sign in required.");
  const { withTaskTransaction } = await import("@/lib/tasks/db.server");

  return withTaskTransaction(caller.id, async (tx) => {
    const roleRows = await tx<{ role: string }[]>`
      select role::text as role
        from public.user_roles
       where user_id = ${caller.id}::uuid
    `;
    const roles = new Set(roleRows.map((row) => row.role));
    const isManager = roleRows.some((row) => MANAGER_ROLES.has(row.role));
    if (!isManager && !roles.has(role)) {
      throw new Error(`This action requires a ${role} account or a manager account.`);
    }

    const [member] = await tx<{ id: string }[]>`
      select id from public.team_members where auth_user_id = ${caller.id}::uuid
    `;
    return operation(tx, {
      id: caller.id,
      roles,
      isManager,
      teamMemberId: member?.id ?? null,
    });
  });
}

async function getTeamAndAccounts(
  tx: TaskTransaction,
): Promise<{ team: TeamMemberDTO[]; accounts: AccountOptionDTO[] }> {
  const members = await tx<TeamMemberDTO[]>`
    select tm.id, tm.full_name as "fullName", tm.department,
           tm.role_title as "roleTitle", tm.auth_user_id as "authUserId",
           p.email
      from public.team_members tm
      left join public.profiles p on p.id = tm.auth_user_id
     where lower(tm.department) like '%sales%'
        or lower(tm.department) like '%support%'
     order by lower(tm.department), tm.full_name, tm.id
  `;
  const accounts = await tx<AccountOptionDTO[]>`
    select distinct p.id, coalesce(p.full_name, p.username, p.id::text) as "fullName",
           p.email, r.role::text as role
      from public.user_roles r
      join public.profiles p on p.id = r.user_id
     where r.role::text in ('sales', 'support')
       and not exists (
         select 1 from public.team_members tm where tm.auth_user_id = p.id
       )
     order by "fullName", role
  `;
  return { team: members, accounts };
}

export const getSalesWorkspace = createServerFn({ method: "GET" }).handler(async () =>
  withActor("sales", async (tx, actor) => {
    const leads = actor.isManager
      ? await tx<LeadDTO[]>`
          select id, reference, company, contact_name as "contactName", email, phone,
                 stage, value::text as value, assigned_to as "assignedTo",
                 created_at::text as "createdAt"
            from public.sales_leads
           order by created_at desc, id
           limit 200
        `
      : actor.teamMemberId
        ? await tx<LeadDTO[]>`
            select id, reference, company, contact_name as "contactName", email, phone,
                   stage, value::text as value, assigned_to as "assignedTo",
                   created_at::text as "createdAt"
              from public.sales_leads
             where assigned_to = ${actor.teamMemberId}::uuid
             order by created_at desc, id
             limit 200
          `
        : [];
    const deals = actor.isManager
      ? await tx<DealDTO[]>`
          select id, reference, title, lead_id as "leadId", stage,
                 value::text as value, probability, owner_id as "ownerId",
                 created_at::text as "createdAt"
            from public.sales_deals
           order by created_at desc, id
           limit 200
        `
      : actor.teamMemberId
        ? await tx<DealDTO[]>`
            select id, reference, title, lead_id as "leadId", stage,
                   value::text as value, probability, owner_id as "ownerId",
                   created_at::text as "createdAt"
              from public.sales_deals
             where owner_id = ${actor.teamMemberId}::uuid
             order by created_at desc, id
             limit 200
          `
        : [];
    const quotes = actor.isManager
      ? await tx<QuoteDTO[]>`
          select id, reference, deal_id as "dealId", owner_id as "ownerId",
                 title, amount::text as amount, status, created_at::text as "createdAt"
            from public.sales_quotes
           order by created_at desc, id
           limit 200
        `
      : actor.teamMemberId
        ? await tx<QuoteDTO[]>`
            select id, reference, deal_id as "dealId", owner_id as "ownerId",
                   title, amount::text as amount, status, created_at::text as "createdAt"
              from public.sales_quotes
             where owner_id = ${actor.teamMemberId}::uuid
             order by created_at desc, id
             limit 200
          `
        : [];
    const directory = actor.isManager ? await getTeamAndAccounts(tx) : { team: [], accounts: [] };
    return {
      isManager: actor.isManager,
      teamMemberId: actor.teamMemberId,
      leads,
      deals,
      quotes,
      ...directory,
    };
  }),
);

const dealStages = [
  "discovery",
  "qualification",
  "proposal",
  "negotiation",
  "won",
  "lost",
] as const;
const currencyAmount = z.string().regex(/^\d{1,12}(?:\.\d{1,2})?$/);

export const createDeal = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z
      .object({
        title: z.string().trim().min(1).max(200),
        leadId: z.string().uuid().nullable().optional(),
        amount: currencyAmount,
        ownerUserId: z.string().uuid().optional(),
      })
      .parse(input),
  )
  .handler(async ({ data }) =>
    withActor("sales", async (tx, actor) => {
      const ownerUserId = actor.isManager ? data.ownerUserId : actor.id;
      if (!ownerUserId) throw new Error("Choose a mapped sales representative for this deal.");
      const [owner] = await tx<{ id: string }[]>`
        select tm.id
          from public.team_members tm
          join public.user_roles r on r.user_id = tm.auth_user_id
         where tm.auth_user_id = ${ownerUserId}::uuid
           and r.role::text = 'sales'
         order by tm.id
         limit 1
      `;
      if (!owner) throw new Error("The deal owner must have a mapped sales account.");
      if (data.leadId) {
        const [lead] = actor.isManager
          ? await tx<{ id: string }[]>`
              select id from public.sales_leads where id = ${data.leadId}::uuid
            `
          : await tx<{ id: string }[]>`
              select id from public.sales_leads
               where id = ${data.leadId}::uuid
                 and assigned_to = ${actor.teamMemberId ?? ""}::uuid
            `;
        if (!lead) throw new Error("The selected lead is not accessible to this sales account.");
      }
      const [deal] = await tx<
        {
          id: string;
          reference: string;
          title: string;
          leadId: string | null;
          stage: string;
          value: string;
          probability: number;
          ownerId: string;
          createdAt: string;
        }[]
      >`
        insert into public.sales_deals (
          reference, title, lead_id, stage, value, probability, owner_id
        )
        values (
          'D-' || upper(substr(gen_random_uuid()::text, 1, 12)),
          ${data.title.trim()}, ${data.leadId ?? null}::uuid,
          'discovery', ${data.amount}::numeric, 50, ${owner.id}::uuid
        )
        returning id, reference, title, lead_id as "leadId", stage,
                  value::text as value, probability, owner_id as "ownerId",
                  created_at::text as "createdAt"
      `;
      if (!deal) throw new Error("Deal creation returned no row.");
      return deal;
    }),
  );

export const updateDealStage = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z
      .object({
        dealId: z.string().uuid(),
        stage: z.enum(dealStages),
      })
      .parse(input),
  )
  .handler(async ({ data }) =>
    withActor("sales", async (tx, actor) => {
      const [deal] = await tx<{ owner_id: string | null }[]>`
        select owner_id
          from public.sales_deals
         where id = ${data.dealId}::uuid
         for update
      `;
      if (!deal) throw new Error("Deal not found.");
      if (!actor.isManager && (!actor.teamMemberId || deal.owner_id !== actor.teamMemberId)) {
        throw new Error("This sales account cannot update the selected deal.");
      }
      const [updated] = await tx<{ id: string; stage: string }[]>`
        update public.sales_deals
           set stage = ${data.stage}, updated_at = now()
         where id = ${data.dealId}::uuid
        returning id, stage
      `;
      if (!updated) throw new Error("Deal stage update returned no row.");
      return updated;
    }),
  );

export const createQuote = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z
      .object({
        dealId: z.string().uuid(),
        title: z.string().trim().min(1).max(200),
        amount: currencyAmount,
      })
      .parse(input),
  )
  .handler(async ({ data }) =>
    withActor("sales", async (tx, actor) => {
      const [deal] = actor.isManager
        ? await tx<{ id: string; owner_id: string }[]>`
            select id, owner_id from public.sales_deals
             where id = ${data.dealId}::uuid
          `
        : actor.teamMemberId
          ? await tx<{ id: string; owner_id: string }[]>`
              select id, owner_id from public.sales_deals
               where id = ${data.dealId}::uuid
                 and owner_id = ${actor.teamMemberId}::uuid
            `
          : [];
      if (!deal) throw new Error("The selected deal is not accessible to this sales account.");
      const [quote] = await tx<
        {
          id: string;
          reference: string;
          dealId: string;
          ownerId: string;
          title: string;
          amount: string;
          status: string;
          createdAt: string;
        }[]
      >`
        insert into public.sales_quotes (
          reference, deal_id, owner_id, title, amount, created_by
        )
        values (
          'Q-' || upper(substr(gen_random_uuid()::text, 1, 12)),
          ${deal.id}::uuid, ${deal.owner_id}::uuid,
          ${data.title.trim()}, ${data.amount}::numeric, ${actor.id}::uuid
        )
        returning id, reference, deal_id as "dealId", owner_id as "ownerId",
                  title, amount::text as amount, status,
                  created_at::text as "createdAt"
      `;
      if (!quote) throw new Error("Quote creation returned no row.");
      return quote;
    }),
  );

export const getSupportWorkspace = createServerFn({ method: "GET" }).handler(async () =>
  withActor("support", async (tx, actor) => {
    const tickets = actor.isManager
      ? await tx<TicketDTO[]>`
          select id, reference, subject, description, customer_name as "customerName",
                 category, priority, status, assigned_to as "assignedTo",
                 created_at::text as "createdAt"
            from public.support_tickets
           order by created_at desc, id
           limit 200
        `
      : actor.teamMemberId
        ? await tx<TicketDTO[]>`
            select id, reference, subject, description, customer_name as "customerName",
                   category, priority, status, assigned_to as "assignedTo",
                   created_at::text as "createdAt"
              from public.support_tickets
             where assigned_to = ${actor.teamMemberId}::uuid
             order by created_at desc, id
             limit 200
          `
        : [];
    const replies = actor.isManager
      ? await tx<ReplyDTO[]>`
          select r.id, r.ticket_id as "ticketId", r.actor_id as "actorId",
                 r.body, r.created_at::text as "createdAt"
            from public.support_replies r
           where r.ticket_id in (select id from public.support_tickets)
           order by r.created_at, r.id
           limit 2000
        `
      : actor.teamMemberId
        ? await tx<ReplyDTO[]>`
            select r.id, r.ticket_id as "ticketId", r.actor_id as "actorId",
                   r.body, r.created_at::text as "createdAt"
              from public.support_replies r
              join public.support_tickets t on t.id = r.ticket_id
             where t.assigned_to = ${actor.teamMemberId}::uuid
             order by r.created_at, r.id
             limit 2000
          `
        : [];
    const directory = actor.isManager ? await getTeamAndAccounts(tx) : { team: [], accounts: [] };
    return {
      isManager: actor.isManager,
      teamMemberId: actor.teamMemberId,
      tickets,
      replies,
      ...directory,
    };
  }),
);

export const linkTeamMember = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z
      .object({
        teamMemberId: z.string().uuid(),
        userId: z.string().uuid(),
      })
      .parse(input),
  )
  .handler(async ({ data }) =>
    withActor("manager", async (tx) => {
      const [member] = await tx<{ id: string; department: string }[]>`
        select id, department
          from public.team_members
         where id = ${data.teamMemberId}::uuid
         for update
      `;
      if (!member) throw new Error("Team member not found.");
      const department = member.department.toLowerCase();
      const requiredRole = department.includes("sales")
        ? "sales"
        : department.includes("support")
          ? "support"
          : null;
      if (!requiredRole) throw new Error("Only Sales and Support team members can be linked here.");
      const [account] = await tx<{ id: string }[]>`
        select user_id as id
          from public.user_roles
         where user_id = ${data.userId}::uuid
           and role::text = ${requiredRole}
      `;
      if (!account) throw new Error(`The selected account must have the ${requiredRole} role.`);
      const [updated] = await tx<{ id: string; auth_user_id: string | null }[]>`
        update public.team_members
           set auth_user_id = ${data.userId}::uuid, updated_at = now()
         where id = ${member.id}::uuid
        returning id, auth_user_id
      `;
      if (!updated) throw new Error("Team account link returned no row.");
      return updated;
    }),
  );

export const createTicket = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z
      .object({
        customerName: z.string().trim().min(1).max(160),
        subject: z.string().trim().min(1).max(200),
        description: z.string().trim().max(5000).nullable().optional(),
        category: z.string().trim().min(1).max(80).default("general"),
        priority: z.enum(["low", "medium", "high", "urgent"]).default("medium"),
        assignedUserId: z.string().uuid().optional(),
      })
      .parse(input),
  )
  .handler(async ({ data }) =>
    withActor("support", async (tx, actor) => {
      let assignedTo = actor.isManager ? null : actor.teamMemberId;
      if (actor.isManager && data.assignedUserId) {
        const [agent] = await tx<{ id: string }[]>`
          select tm.id
            from public.team_members tm
            join public.user_roles r on r.user_id = tm.auth_user_id
           where tm.auth_user_id = ${data.assignedUserId}::uuid
             and r.role::text = 'support'
           order by tm.id limit 1
        `;
        if (!agent) throw new Error("The assigned account must be a mapped support agent.");
        assignedTo = agent.id;
      } else if (!actor.isManager && !assignedTo) {
        throw new Error("Ask a manager to link this Support account to a team member first.");
      }
      const [ticket] = await tx<
        {
          id: string;
          reference: string;
          subject: string;
          description: string | null;
          customerName: string;
          category: string;
          priority: string;
          status: string;
          assignedTo: string | null;
          createdAt: string;
        }[]
      >`
        insert into public.support_tickets (
          reference, subject, description, customer_name, channel,
          category, priority, status, assigned_to
        )
        values (
          'SUP-' || upper(substr(gen_random_uuid()::text, 1, 12)),
          ${data.subject.trim()}, ${data.description?.trim() || null},
          ${data.customerName.trim()}, 'internal',
          ${data.category.trim()}, ${data.priority}, 'new',
          ${assignedTo}::uuid
        )
        returning id, reference, subject, description, customer_name as "customerName",
                  category, priority, status, assigned_to as "assignedTo",
                  created_at::text as "createdAt"
      `;
      if (!ticket) throw new Error("Ticket creation returned no row.");
      return ticket;
    }),
  );

export const replyToTicket = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z
      .object({
        ticketId: z.string().uuid(),
        body: z.string().trim().min(1).max(5000),
      })
      .parse(input),
  )
  .handler(async ({ data }) =>
    withActor("support", async (tx, actor) => {
      const [ticket] = await tx<{ id: string; assigned_to: string | null }[]>`
        select id, assigned_to
          from public.support_tickets
         where id = ${data.ticketId}::uuid
         for update
      `;
      if (!ticket) throw new Error("Ticket not found.");
      if (!actor.isManager && (!actor.teamMemberId || ticket.assigned_to !== actor.teamMemberId)) {
        throw new Error("This Support account cannot reply to the selected ticket.");
      }
      const [reply] = await tx<
        {
          id: string;
          ticketId: string;
          actorId: string;
          body: string;
          createdAt: string;
        }[]
      >`
        insert into public.support_replies (ticket_id, actor_id, body)
        values (${ticket.id}::uuid, ${actor.id}::uuid, ${data.body.trim()})
        returning id, ticket_id as "ticketId", actor_id as "actorId",
                  body, created_at::text as "createdAt"
      `;
      if (!reply) throw new Error("Ticket reply creation returned no row.");
      await tx`
        update public.support_tickets
           set first_response_at = coalesce(first_response_at, now()),
               updated_at = now()
         where id = ${ticket.id}::uuid
      `;
      return reply;
    }),
  );

export const assignTicket = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z
      .object({
        ticketId: z.string().uuid(),
        agentUserId: z.string().uuid(),
      })
      .parse(input),
  )
  .handler(async ({ data }) =>
    withActor("manager", async (tx) => {
      const [agent] = await tx<{ id: string }[]>`
        select tm.id
          from public.team_members tm
          join public.user_roles r on r.user_id = tm.auth_user_id
         where tm.auth_user_id = ${data.agentUserId}::uuid
           and r.role::text = 'support'
         order by tm.id limit 1
      `;
      if (!agent) throw new Error("The assigned account must be a mapped support agent.");
      const [ticket] = await tx<{ id: string; assigned_to: string }[]>`
        update public.support_tickets
           set assigned_to = ${agent.id}::uuid, updated_at = now()
         where id = ${data.ticketId}::uuid
        returning id, assigned_to
      `;
      if (!ticket) throw new Error("Ticket not found.");
      return ticket;
    }),
  );
