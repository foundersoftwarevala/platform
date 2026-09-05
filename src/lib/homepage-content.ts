// DB-backed homepage layout content: homepage_sections + feature_strip_items.
import { supabase } from "@/integrations/supabase/client";

export type HomepageSection = {
  id: string;
  section_key: string;
  label: string;
  position: number;
  visible: boolean;
};

export type FeatureStripItem = {
  id: string;
  label: string;
  icon_name: string;
  color_class: string;
  position: number;
  visible: boolean;
};

export async function fetchHomepageSections(): Promise<HomepageSection[]> {
  const { data, error } = await supabase
    .from("homepage_sections" as never)
    .select("id,section_key,label,position,visible")
    .order("position", { ascending: true });
  if (error) throw error;
  return (data ?? []) as unknown as HomepageSection[];
}

export async function updateHomepageSection(id: string, patch: Partial<HomepageSection>) {
  const { error } = await supabase.from("homepage_sections" as never).update(patch as never).eq("id", id);
  if (error) throw error;
}

export async function reorderHomepageSectionRows(orderedIds: string[]) {
  await Promise.all(
    orderedIds.map(async (id, i) => {
      const { error } = await supabase
        .from("homepage_sections" as never)
        .update({ position: i * 10 } as never)
        .eq("id", id);
      if (error) throw error;
    }),
  );
}

export async function fetchFeatureStripItems(): Promise<FeatureStripItem[]> {
  const { data, error } = await supabase
    .from("feature_strip_items" as never)
    .select("id,label,icon_name,color_class,position,visible")
    .order("position", { ascending: true });
  if (error) throw error;
  return (data ?? []) as unknown as FeatureStripItem[];
}

export async function updateFeatureStripItem(id: string, patch: Partial<FeatureStripItem>) {
  const { error } = await supabase.from("feature_strip_items" as never).update(patch as never).eq("id", id);
  if (error) throw error;
}

export async function createFeatureStripItem(input: Partial<FeatureStripItem>) {
  const payload = {
    label: input.label ?? "New badge",
    icon_name: input.icon_name ?? "Sparkles",
    color_class: input.color_class ?? "text-cyan-300",
    position: input.position ?? 99,
    visible: input.visible ?? true,
  };
  const { error } = await supabase.from("feature_strip_items" as never).insert(payload as never);
  if (error) throw error;
}

export async function deleteFeatureStripItem(id: string) {
  const { error } = await supabase.from("feature_strip_items" as never).delete().eq("id", id);
  if (error) throw error;
}

export async function reorderFeatureStripItems(orderedIds: string[]) {
  await Promise.all(
    orderedIds.map(async (id, i) => {
      const { error } = await supabase
        .from("feature_strip_items" as never)
        .update({ position: i } as never)
        .eq("id", id);
      if (error) throw error;
    }),
  );
}
