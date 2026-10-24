import { withTaskTransaction, type TaskTransaction } from "@/lib/tasks/db.server";

import {
  AYRA_COMMAND_SETTINGS_KEY,
  AyraCommandSettingsSchema,
  DEFAULT_AYRA_COMMAND_SETTINGS,
  type AyraCommandSettings,
} from "./command-settings";
import { requireAyraActor } from "./core.server";

function parseSettings(value: string | undefined): AyraCommandSettings {
  if (value === undefined) return DEFAULT_AYRA_COMMAND_SETTINGS;

  let parsed: unknown;
  try {
    parsed = JSON.parse(value);
  } catch {
    throw new Error("Stored AYRA Command Center settings are not valid JSON.");
  }

  const result = AyraCommandSettingsSchema.safeParse(parsed);
  if (!result.success) {
    throw new Error("Stored AYRA Command Center settings have an invalid shape.");
  }
  return result.data;
}

async function assertAyraRole(tx: TaskTransaction, actorId: string): Promise<void> {
  const roles = await tx<{ role: string }[]>`
    select role::text as role
      from public.user_roles
     where user_id = ${actorId}::uuid
  `;
  if (!roles.some(({ role }) => role === "boss" || role === "admin")) {
    throw new Error("Ayra access requires the boss or admin role.");
  }
}

export async function getAyraCommandSettings(): Promise<AyraCommandSettings> {
  const actorId = await requireAyraActor();
  return withTaskTransaction(actorId, async (tx) => {
    const rows = await tx<{ value: string }[]>`
      select value
        from public.system_settings
       where key = ${AYRA_COMMAND_SETTINGS_KEY}
       limit 1
    `;
    return parseSettings(rows[0]?.value);
  });
}

export async function saveAyraCommandSettings(
  settings: AyraCommandSettings,
): Promise<AyraCommandSettings> {
  const actorId = await requireAyraActor();
  const validated = AyraCommandSettingsSchema.parse(settings);

  return withTaskTransaction(actorId, async (tx) => {
    await assertAyraRole(tx, actorId);

    const rows = await tx<{ value: string }[]>`
      select value
        from public.system_settings
       where key = ${AYRA_COMMAND_SETTINGS_KEY}
       for update
    `;
    const previous = parseSettings(rows[0]?.value);
    const value = JSON.stringify(validated);

    await tx`
      insert into public.system_settings (
        key, label, value, value_type, category, description, updated_at
      ) values (
        ${AYRA_COMMAND_SETTINGS_KEY},
        'AYRA Command Center Settings',
        ${value},
        'json',
        'ai_ceo',
        'AYRA display and motion preferences; does not grant platform access.',
        now()
      )
      on conflict (key) do update
        set value = excluded.value,
            value_type = excluded.value_type,
            updated_at = now()
    `;

    await tx`
      insert into public.audit_logs (
        actor_id, actor, action, entity_type, entity_id, severity, metadata
      ) values (
        ${actorId}::uuid, ${actorId}, 'ayra.settings.updated', 'ayra',
        ${AYRA_COMMAND_SETTINGS_KEY}, 'info',
        ${JSON.stringify({ previous, next: validated })}::jsonb
      )
    `;

    return validated;
  });
}
