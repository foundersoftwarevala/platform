import { useState, type FormEvent } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Copy, Loader2, UserPlus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/rd-module/ui/button";
import { Input } from "@/components/rd-module/ui/input";
import {
  inviteTeamMember,
  listTeamMembers,
  setMemberActive,
} from "@/lib/rd-module/rd-gate.functions";

export function TeamMembersPanel() {
  const qc = useQueryClient();
  const list = useServerFn(listTeamMembers);
  const invite = useServerFn(inviteTeamMember);
  const toggle = useServerFn(setMemberActive);
  const { data: members = [], isLoading } = useQuery({
    queryKey: ["rd-team"],
    queryFn: () => list(),
  });
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [lastCode, setLastCode] = useState<{ email: string; code: string } | null>(null);

  async function add(e: FormEvent, em = email, nm = name) {
    e.preventDefault();
    setBusy(true);
    try {
      const r = await invite({ data: { email: em, name: nm } });
      setLastCode({ email: em, code: r.code });
      setEmail("");
      setName("");
      qc.invalidateQueries({ queryKey: ["rd-team"] });
    } catch (x) {
      toast.error(x instanceof Error ? x.message : "Could not add member");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="panel space-y-5 p-6">
      <div>
        <h2 className="font-display text-lg font-semibold text-foreground">Team members</h2>
        <p className="text-sm text-muted-foreground">
          R&D roster manage karein. Access existing Control Panel roles se milta hai; yahan naya
          login ya password nahi banta.
        </p>
      </div>
      <form onSubmit={(e) => add(e)} className="flex flex-col gap-2 sm:flex-row">
        <Input
          className="h-11"
          placeholder="Naam"
          aria-label="Name"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <Input
          className="h-11"
          type="email"
          required
          placeholder="email@company.com"
          aria-label="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <Button type="submit" className="h-11" disabled={busy || !email}>
          {busy ? <Loader2 className="animate-spin" /> : <UserPlus />} Add
        </Button>
      </form>
      {lastCode && (
        <div className="rounded-xl border border-success/40 bg-success/10 p-4 text-sm">
          <p className="text-foreground">
            Control Panel sign-in for <b>{lastCode.email}</b> (existing account required):
          </p>
          <div className="mt-2 flex items-center gap-2">
            <code className="rounded-lg bg-surface-2 px-3 py-1.5 font-mono text-base text-success">
              {lastCode.code}
            </code>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => {
                navigator.clipboard.writeText(lastCode.code);
                toast.success("Copied");
              }}
            >
              <Copy /> Copy
            </Button>
          </div>
        </div>
      )}
      {isLoading ? (
        <Loader2 className="h-5 w-5 animate-spin text-brand" />
      ) : members.length === 0 ? (
        <p className="text-sm text-muted-foreground">Abhi koi member nahi hai.</p>
      ) : (
        <ul className="divide-y divide-border rounded-xl border border-border">
          {members.map((m) => (
            <li key={m.id} className="flex flex-wrap items-center gap-3 p-3">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-foreground">{m.name || m.email}</p>
                <p className="truncate text-xs text-muted-foreground">{m.email}</p>
              </div>
              <span
                className={
                  m.active
                    ? m.hasPassword
                      ? "text-xs text-success"
                      : "text-xs text-warning"
                    : "text-xs text-danger"
                }
              >
                {!m.active
                  ? "Disabled"
                  : m.hasPassword
                    ? "Active"
                    : "Control Panel account required"}
              </span>
              <Button size="sm" variant="outline" onClick={(e) => add(e, m.email, m.name)}>
                Update roster
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={async () => {
                  await toggle({ data: { id: m.id, active: !m.active } });
                  qc.invalidateQueries({ queryKey: ["rd-team"] });
                }}
              >
                {m.active ? "Disable" : "Enable"}
              </Button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
