import { cn } from "@/lib/utils";
import { DEPARTMENTS, type Department } from "@/lib/ams/types";

export function DepartmentBadge({ department, className }: { department?: Department; className?: string }) {
  if (!department) return null;
  const meta = DEPARTMENTS.find((d) => d.value === department);
  if (!meta) return null;
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium uppercase tracking-[0.15em]",
        className,
      )}
      style={{ color: meta.accent, borderColor: `${meta.accent}55`, background: `${meta.accent}10` }}
    >
      {meta.label}
    </span>
  );
}
