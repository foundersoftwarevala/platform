import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Plus, MoreVertical, Trash2, Archive, RotateCcw, Send, Ban, Check, X,
  Copy, Power, Eye, Pencil, LayoutGrid, List as ListIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PageHeader } from "@/components/ams/shared/PageHeader";
import { FilterBar } from "@/components/ams/shared/FilterBar";
import { EmptyState } from "@/components/ams/shared/EmptyState";
import { RarityBadge } from "@/components/ams/shared/RarityBadge";
import { StatusPill } from "@/components/ams/shared/StatusPill";
import { AwardCard } from "@/components/ams/shared/AwardCard";
import {
  listAwards, deleteAward, archiveAward, restoreAward,
  approveAward, rejectAward, publishAward, unpublishAward,
  cloneAward, enableAward, disableAward,
  bulkDelete, bulkSetStatus,
} from "@/lib/ams/awards.api";
import type { AwardFilters, AwardStatus } from "@/lib/ams/types";
import { toast } from "sonner";

export const Route = createFileRoute("/ams/awards/")({
  head: () => ({
    meta: [
      { title: "Award Management — AMS" },
      { name: "description", content: "Create, edit, approve, publish and archive every award, trophy, badge, achievement and rank used across the Software Vala ecosystem." },
      { property: "og:title", content: "Award Management — AMS" },
      { property: "og:description", content: "Create, edit, approve, publish and archive every award, trophy, badge, achievement and rank used across the Software Vala ecosystem." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: AwardsListPage,
});

function AwardsListPage() {
  const qc = useQueryClient();
  const [filters, setFilters] = useState<AwardFilters>({});
  const [view, setView] = useState<"grid" | "table">("grid");
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const { data, isLoading } = useQuery({
    queryKey: ["awards", filters],
    queryFn: () => listAwards(filters),
  });
  const rows = data?.rows ?? [];

  const invalidate = () => qc.invalidateQueries({ queryKey: ["awards"] });
  const run = (fn: () => Promise<unknown>, ok: string) =>
    fn().then(() => { invalidate(); toast.success(ok); }).catch((e: Error) => toast.error(e.message));

  const toggle = (id: string) => {
    const next = new Set(selected);
    next.has(id) ? next.delete(id) : next.add(id);
    setSelected(next);
  };
  const allSelected = rows.length > 0 && rows.every((r) => selected.has(r.id));
  const ids = Array.from(selected);

  const bulk = useMutation({
    mutationFn: async (action: "delete" | AwardStatus) => {
      if (action === "delete") return bulkDelete(ids);
      return bulkSetStatus(ids, action);
    },
    onSuccess: (n, action) => {
      setSelected(new Set());
      invalidate();
      toast.success(`Bulk ${action}: ${n} item(s)`);
    },
  });

  return (
    <div className="space-y-6 max-w-[1600px] mx-auto">
      <PageHeader
        kicker="Award Management Center"
        title="All awards"
        description="Create, edit, approve, publish and archive every award, trophy, badge, achievement and rank used across the Software Vala ecosystem."
        actions={
          <Button asChild className="gap-1.5 bg-gradient-to-r from-trophy to-legendary text-background hover:opacity-90">
            <Link to="/awards/new"><Plus className="h-4 w-4" /> New award</Link>
          </Button>
        }
      />

      <div className="flex flex-wrap items-center gap-3">
        <FilterBar value={filters} onChange={setFilters} />
        <div className="ml-auto">
          <Tabs value={view} onValueChange={(v) => setView(v as "grid" | "table")}>
            <TabsList className="bg-muted/30">
              <TabsTrigger value="grid" className="gap-1.5"><LayoutGrid className="h-3.5 w-3.5" /> Grid</TabsTrigger>
              <TabsTrigger value="table" className="gap-1.5"><ListIcon className="h-3.5 w-3.5" /> Table</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
      </div>

      {selected.size > 0 && (
        <div className="surface-card flex flex-wrap items-center gap-2 px-4 py-2.5">
          <div className="text-sm font-medium">{selected.size} selected</div>
          <div className="ml-auto flex flex-wrap gap-1.5">
            <Button size="sm" variant="outline" onClick={() => bulk.mutate("published")} className="gap-1.5"><Send className="h-3.5 w-3.5" /> Publish</Button>
            <Button size="sm" variant="outline" onClick={() => bulk.mutate("unpublished")} className="gap-1.5"><Ban className="h-3.5 w-3.5" /> Unpublish</Button>
            <Button size="sm" variant="outline" onClick={() => bulk.mutate("archived")} className="gap-1.5"><Archive className="h-3.5 w-3.5" /> Archive</Button>
            <Button size="sm" variant="outline" onClick={() => bulk.mutate("delete")} className="gap-1.5 text-destructive"><Trash2 className="h-3.5 w-3.5" /> Delete</Button>
            <Button size="sm" variant="ghost" onClick={() => setSelected(new Set())}>Clear</Button>
          </div>
        </div>
      )}

      {isLoading ? (
        <div className="surface-card p-8 text-center text-sm text-muted-foreground">Loading awards…</div>
      ) : rows.length === 0 ? (
        <EmptyState
          title="No awards yet"
          description="Build your first award — trophy, badge, achievement, rank, milestone or streak — and it will appear here, in libraries, and in every dashboard that subscribes to it."
          action={<Button asChild className="gap-1.5"><Link to="/awards/new"><Plus className="h-4 w-4" /> Create award</Link></Button>}
        />
      ) : view === "grid" ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {rows.map((a) => (
            <div key={a.id} className="relative">
              <div className="absolute left-3 top-3 z-10">
                <Checkbox checked={selected.has(a.id)} onCheckedChange={() => toggle(a.id)} aria-label="Select award" />
              </div>
              <AwardCard award={a} />
            </div>
          ))}
        </div>
      ) : (
        <div className="surface-card overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10">
                  <Checkbox
                    checked={allSelected}
                    onCheckedChange={(c) => setSelected(c ? new Set(rows.map((r) => r.id)) : new Set())}
                  />
                </TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Rarity</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">XP</TableHead>
                <TableHead className="w-10" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((a) => (
                <TableRow key={a.id}>
                  <TableCell><Checkbox checked={selected.has(a.id)} onCheckedChange={() => toggle(a.id)} /></TableCell>
                  <TableCell>
                    <Link to="/awards/$id" params={{ id: a.id }} className="font-medium hover:text-trophy">{a.name}</Link>
                    <div className="text-xs text-muted-foreground line-clamp-1">{a.description}</div>
                  </TableCell>
                  <TableCell className="capitalize text-sm">{a.type}</TableCell>
                  <TableCell className="capitalize text-sm">{a.category}</TableCell>
                  <TableCell><RarityBadge rarity={a.rarity} /></TableCell>
                  <TableCell><StatusPill status={a.status} /></TableCell>
                  <TableCell className="text-right font-mono text-trophy">+{a.rewards.xp.toLocaleString()}</TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild><Button variant="ghost" size="icon" title="Award actions" aria-label={`Actions for ${a.name}`}><MoreVertical className="h-4 w-4" /></Button></DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem asChild><Link to="/awards/$id" params={{ id: a.id }}><Eye className="h-4 w-4 mr-2" /> View</Link></DropdownMenuItem>
                        <DropdownMenuItem asChild><Link to="/awards/$id/edit" params={{ id: a.id }}><Pencil className="h-4 w-4 mr-2" /> Edit</Link></DropdownMenuItem>
                        <DropdownMenuItem onClick={() => run(() => cloneAward(a.id), "Cloned")}><Copy className="h-4 w-4 mr-2" /> Clone</DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={() => run(() => approveAward(a.id), "Approved")}><Check className="h-4 w-4 mr-2" /> Approve</DropdownMenuItem>
                        <DropdownMenuItem onClick={() => run(() => rejectAward(a.id), "Rejected")}><X className="h-4 w-4 mr-2" /> Reject</DropdownMenuItem>
                        <DropdownMenuItem onClick={() => run(() => publishAward(a.id), "Published")}><Send className="h-4 w-4 mr-2" /> Publish</DropdownMenuItem>
                        <DropdownMenuItem onClick={() => run(() => unpublishAward(a.id), "Unpublished")}><Ban className="h-4 w-4 mr-2" /> Unpublish</DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={() => run(() => enableAward(a.id), "Enabled")}><Power className="h-4 w-4 mr-2" /> Enable</DropdownMenuItem>
                        <DropdownMenuItem onClick={() => run(() => disableAward(a.id), "Disabled")}><Power className="h-4 w-4 mr-2" /> Disable</DropdownMenuItem>
                        <DropdownMenuItem onClick={() => run(() => archiveAward(a.id), "Archived")}><Archive className="h-4 w-4 mr-2" /> Archive</DropdownMenuItem>
                        <DropdownMenuItem onClick={() => run(() => restoreAward(a.id), "Restored")}><RotateCcw className="h-4 w-4 mr-2" /> Restore</DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={() => run(() => deleteAward(a.id), "Deleted")} className="text-destructive"><Trash2 className="h-4 w-4 mr-2" /> Delete</DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
