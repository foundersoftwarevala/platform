import { menuItems } from "../LMSidebar";

/** Resolve a sidebar sub-section id into its human label so screens can focus on it. */
export function subsectionLabel(id: string): string | null {
  for (const item of menuItems) {
    if (item.id === id) return null;
    const child = item.children?.find((c) => c.id === id);
    if (child) return child.label;
  }
  return null;
}
