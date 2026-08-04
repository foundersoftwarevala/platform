import { useState } from "react";
import { PageHeader, Card, PillButton } from "../ui";
import {
  ACTIONS, type ActionId,
  ActionButton, RowActions, TableToolbar, BulkActionBar,
  DetailActionRail, ColorPicker, ThemeFieldset,
} from "../actions";

// Showcase + spec page that every module follows.
export function ToolkitSection() {
  const [selected, setSelected] = useState(3);
  const allActions = Object.keys(ACTIONS) as ActionId[];

  return (
    <div className="px-4 py-8 md:px-8">
      <PageHeader
        eyebrow="Enterprise Action Kit · Locked Contract"
        title="Marketplace Action Toolkit"
        description="One contract for buttons, table toolbars, bulk actions, detail rails and color management — applied consistently across every Marketplace module."
        actions={<PillButton variant="primary">Apply Across Modules</PillButton>}
      />

      {/* 1. Single action buttons */}
      <Card className="mb-6">
        <SectionTitle index="01" title="Action Buttons" hint="Per-row & per-card actions. Filtered by Role & Permission." />
        <div className="flex flex-wrap gap-2">
          {allActions.map((id) => <ActionButton key={id} action={id} />)}
        </div>
      </Card>

      {/* 2. Table toolbar */}
      <Card className="mb-6">
        <SectionTitle index="02" title="Table Toolbar" hint="Top of every list module — Search · Filter · Sort · Columns · Refresh · Import · Export · Add · Settings." />
        <TableToolbar title="Products" count={0} extraActions={["publish", "feature"]} />
        <div className="rounded-xl border border-dashed border-border bg-background/30 p-6 text-center text-xs text-muted-foreground">
          List rows render below — connect live data source.
        </div>
      </Card>

      {/* 3. Bulk action bar */}
      <Card className="mb-6">
        <SectionTitle index="03" title="Bulk Actions" hint="Appears when ≥1 row is selected. Sticky under the top bar." />
        <div className="mb-3 flex flex-wrap items-center gap-2">
          {[0, 1, 5, 12, 48].map((n) => (
            <button
              key={n}
              onClick={() => setSelected(n)}
              className={`rounded-lg border px-3 py-1 text-[11px] font-semibold ${selected === n ? "border-accent/50 bg-accent/10 text-foreground" : "border-border bg-white/[0.04] text-muted-foreground hover:text-foreground"}`}
            >
              Select {n}
            </button>
          ))}
        </div>
        <BulkActionBar selectedCount={selected} onClear={() => setSelected(0)} />
        {selected === 0 && (
          <div className="rounded-xl border border-dashed border-border bg-background/30 p-4 text-center text-[11px] text-muted-foreground">
            Bulk bar hidden — select rows to reveal.
          </div>
        )}
      </Card>

      {/* 4. Row actions */}
      <Card className="mb-6">
        <SectionTitle index="04" title="Row Actions" hint="Compact icon cluster used in every list row." />
        <div className="space-y-2">
          {["Pending Banner", "Approved Vendor", "Draft Offer", "Live Wall"].map((label) => (
            <div key={label} className="flex items-center justify-between rounded-xl border border-border bg-background/40 px-4 py-2.5">
              <div className="flex items-center gap-3">
                <span className="h-8 w-8 rounded-lg bg-gradient-to-br from-primary/30 to-accent/30" />
                <div className="text-sm font-semibold">{label}</div>
              </div>
              <RowActions ids={["view", "edit", "approve", "reject", "duplicate", "archive", "delete"]} />
            </div>
          ))}
        </div>
      </Card>

      {/* 5. Detail page action rail */}
      <Card className="mb-6">
        <SectionTitle index="05" title="Detail Page Rail" hint="Applies on product / vendor / order detail pages." />
        <DetailActionRail />
        <div className="rounded-xl border border-dashed border-border bg-background/30 p-6 text-center text-xs text-muted-foreground">
          Detail content below — gallery, demo, docs, reviews, license, audit logs.
        </div>
      </Card>

      {/* 6. Color management */}
      <Card className="mb-6">
        <SectionTitle index="06" title="Color Management" hint="Locked Software Vala palette with HEX / RGB / HSL · presets · live preview · reset." />
        <div className="space-y-4">
          <ThemeFieldset title="Brand">
            <ColorPicker label="Primary"   defaultValue="#0EA5E9" />
            <ColorPicker label="Secondary" defaultValue="#0C6478" />
            <ColorPicker label="Accent"    defaultValue="#09D1C7" />
          </ThemeFieldset>
          <ThemeFieldset title="Semantic">
            <ColorPicker label="Success" defaultValue="#22C55E" />
            <ColorPicker label="Warning" defaultValue="#F59E0B" />
            <ColorPicker label="Danger"  defaultValue="#EF4444" />
            <ColorPicker label="Info"    defaultValue="#06B6D4" />
            <ColorPicker label="Premium" defaultValue="#F5C518" />
          </ThemeFieldset>
          <ThemeFieldset title="Surfaces">
            <ColorPicker label="Background" defaultValue="#0F172A" />
            <ColorPicker label="Card"       defaultValue="#1E293B" />
            <ColorPicker label="Banner"     defaultValue="#213A58" />
            <ColorPicker label="Text"       defaultValue="#FFFFFF" />
            <ColorPicker label="Button"     defaultValue="#0EA5E9" />
          </ThemeFieldset>

          <div className="glass rounded-2xl p-4">
            <div className="mb-3 text-sm font-bold">Gradient Picker</div>
            <div className="grid gap-3 md:grid-cols-2">
              <ColorPicker label="Gradient · Start" defaultValue="#0EA5E9" />
              <ColorPicker label="Gradient · End"   defaultValue="#09D1C7" />
            </div>
            <div className="mt-3 h-16 rounded-xl ring-1 ring-border" style={{ background: "linear-gradient(135deg,#0EA5E9,#09D1C7)" }} />
          </div>

          <div className="glass rounded-2xl p-4">
            <div className="mb-3 text-sm font-bold">Theme Presets</div>
            <div className="flex flex-wrap gap-2">
              {[
                ["SV Default", ["#0EA5E9","#09D1C7","#22C55E","#F5C518"]],
                ["Midnight",   ["#0F172A","#1E293B","#0EA5E9","#FFFFFF"]],
                ["Aurora",     ["#46DFB1","#09D1C7","#0EA5E9","#0C6478"]],
                ["Sunset",     ["#F59E0B","#F5C518","#EF4444","#0F172A"]],
              ].map(([name, colors]) => (
                <button key={name as string} className="flex items-center gap-2 rounded-xl border border-border bg-background/40 px-3 py-2 transition-colors hover:border-accent/50">
                  <div className="flex">
                    {(colors as string[]).map((c) => (
                      <span key={c} style={{ background: c }} className="h-4 w-4 rounded-sm ring-1 ring-black/20 -mr-1 last:mr-0" />
                    ))}
                  </div>
                  <span className="text-[12px] font-semibold">{name as string}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </Card>

      {/* 7. Permission contract */}
      <Card>
        <SectionTitle index="07" title="Role & Permission Contract" hint="Buttons render but are filtered by capability — never hidden inside three-dot menus." />
        <div className="grid gap-2 md:grid-cols-2 lg:grid-cols-3">
          {[
            ["Owner",   "All actions visible"],
            ["Admin",   "All except billing-level delete"],
            ["Manager", "Add · Edit · Approve · Reject · Archive"],
            ["Editor",  "Add · Edit · Duplicate"],
            ["Author",  "Edit own · Duplicate own"],
            ["Viewer",  "View · Export only"],
          ].map(([role, caps]) => (
            <div key={role} className="rounded-xl border border-border bg-background/40 p-3">
              <div className="text-sm font-bold">{role}</div>
              <div className="mt-1 text-[11px] text-muted-foreground">{caps}</div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

function SectionTitle({ index, title, hint }: { index: string; title: string; hint: string }) {
  return (
    <div className="mb-4 flex items-baseline gap-3">
      <span className="font-mono text-[10px] tabular text-accent">{index}</span>
      <div>
        <h3 className="text-sm font-bold">{title}</h3>
        <p className="text-[11px] text-muted-foreground">{hint}</p>
      </div>
    </div>
  );
}
