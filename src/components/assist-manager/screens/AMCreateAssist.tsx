/**
 * CREATE NEW ASSIST
 * Primary flow for creating assist sessions — writes to the backend.
 */

import { useState } from "react";
import { Brain, Clock, PlusCircle, Save, Shield, User, X } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { useAgents, useCreateAssist, useEndUsers } from "@/lib/assist-manager/hooks";
import { ScreenHeader, titleCase } from "../am-ui";
import { useAM } from "../am-context";

const PERMISSIONS = [
  { id: "screen_view", label: "Screen View" },
  { id: "chat", label: "Chat" },
  { id: "keyboard", label: "Keyboard" },
  { id: "mouse", label: "Mouse" },
  { id: "file_transfer", label: "File Transfer" },
];

const DRAFT_KEY = "vala-assist-draft";

interface FormState {
  assistType: string;
  endUserId: string;
  agentId: string;
  accessMode: string;
  durationMinutes: string;
  purpose: string;
  permissions: string[];
  aiAssist: boolean;
}

const EMPTY: FormState = {
  assistType: "support",
  endUserId: "",
  agentId: "",
  accessMode: "view_only",
  durationMinutes: "30",
  purpose: "",
  permissions: ["screen_view", "chat"],
  aiAssist: true,
};

export function AMCreateAssist() {
  const [form, setForm] = useState<FormState>(EMPTY);
  const { data: endUsers = [] } = useEndUsers();
  const { data: agents = [] } = useAgents();
  const createAssist = useCreateAssist();
  const { setSection } = useAM();

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const submit = () => {
    if (!form.endUserId || !form.agentId) {
      toast.error("Select both a target user and an assisting agent");
      return;
    }
    if (form.purpose.trim().length < 5) {
      toast.error("Describe the purpose of this session");
      return;
    }
    createAssist.mutate(
      {
        endUserId: form.endUserId,
        agentId: form.agentId,
        assistType: form.assistType,
        accessMode: form.accessMode,
        purpose: form.purpose.trim(),
        durationMinutes: Number(form.durationMinutes),
        permissions: form.permissions,
        aiAssist: form.aiAssist,
      },
      {
        onSuccess: () => {
          setForm(EMPTY);
          setSection("pending_approval");
        },
      },
    );
  };

  const saveDraft = () => {
    if (typeof window !== "undefined") {
      window.localStorage.setItem(DRAFT_KEY, JSON.stringify(form));
      toast.success("Draft saved on this device");
    }
  };

  const loadDraft = () => {
    if (typeof window === "undefined") return;
    const raw = window.localStorage.getItem(DRAFT_KEY);
    if (!raw) {
      toast.info("No saved draft found");
      return;
    }
    setForm({ ...EMPTY, ...(JSON.parse(raw) as FormState) });
    toast.success("Draft restored");
  };

  return (
    <ScrollArea className="h-full">
      <div className="space-y-6 p-6">
        <ScreenHeader
          title="Create New Assist"
          subtitle="Initialize a new remote assist session"
          actions={
            <Button variant="ghost" size="sm" onClick={loadDraft}>
              Restore draft
            </Button>
          }
        />

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <PlusCircle className="h-5 w-5 text-primary" />
                Session Configuration
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Assist Type</Label>
                  <Select value={form.assistType} onValueChange={(v) => set("assistType", v)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select assist type" />
                    </SelectTrigger>
                    <SelectContent>
                      {["support", "dev", "sales", "franchise", "internal"].map((t) => (
                        <SelectItem key={t} value={t}>
                          {titleCase(t)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Target User</Label>
                  <Select value={form.endUserId} onValueChange={(v) => set("endUserId", v)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select target user" />
                    </SelectTrigger>
                    <SelectContent>
                      {endUsers.map((u) => (
                        <SelectItem key={u.id} value={u.id}>
                          {u.user_code} · {titleCase(u.role)} · {u.device}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Assisting Agent</Label>
                  <Select value={form.agentId} onValueChange={(v) => set("agentId", v)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select agent" />
                    </SelectTrigger>
                    <SelectContent>
                      {agents.map((a) => (
                        <SelectItem key={a.id} value={a.id}>
                          {a.agent_code} · {a.display_name} · {titleCase(a.status)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Permission Scope</Label>
                  <Select value={form.accessMode} onValueChange={(v) => set("accessMode", v)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select permission scope" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="view_only">View Only</SelectItem>
                      <SelectItem value="control_limited">Control (Limited)</SelectItem>
                      <SelectItem value="control_full">Control (Full)</SelectItem>
                      <SelectItem value="file_transfer">File Transfer Only</SelectItem>
                      <SelectItem value="chat_only">Chat Only</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Duration Limit</Label>
                  <Select
                    value={form.durationMinutes}
                    onValueChange={(v) => set("durationMinutes", v)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select duration" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="15">15 Minutes</SelectItem>
                      <SelectItem value="30">30 Minutes</SelectItem>
                      <SelectItem value="60">1 Hour</SelectItem>
                      <SelectItem value="120">2 Hours</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Purpose / Reason</Label>
                <Textarea
                  rows={3}
                  placeholder="Describe why this assist session is needed…"
                  value={form.purpose}
                  onChange={(e) => set("purpose", e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label>Granted Permissions</Label>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                  {PERMISSIONS.map((p) => (
                    <label
                      key={p.id}
                      className="flex items-center gap-2 rounded-lg border border-border bg-muted/40 p-2.5 text-sm"
                    >
                      <Checkbox
                        checked={form.permissions.includes(p.id)}
                        onCheckedChange={(checked) =>
                          set(
                            "permissions",
                            checked
                              ? [...form.permissions, p.id]
                              : form.permissions.filter((x) => x !== p.id),
                          )
                        }
                      />
                      {p.label}
                    </label>
                  ))}
                </div>
              </div>

              <div className="flex items-center justify-between rounded-lg border border-border bg-muted/40 p-4">
                <div className="flex items-center gap-3">
                  <Brain className="h-5 w-5 text-primary" />
                  <div>
                    <p className="font-medium">AI Assist Layer</p>
                    <p className="text-xs text-muted-foreground">
                      Enable AI monitoring and suggestions
                    </p>
                  </div>
                </div>
                <Switch checked={form.aiAssist} onCheckedChange={(v) => set("aiAssist", v)} />
              </div>

              <div className="flex flex-wrap gap-3 pt-2">
                <Button className="flex-1" onClick={submit} disabled={createAssist.isPending}>
                  <PlusCircle className="mr-2 h-4 w-4" />
                  Request Assist
                </Button>
                <Button variant="outline" onClick={saveDraft}>
                  <Save className="mr-2 h-4 w-4" />
                  Save Draft
                </Button>
                <Button variant="ghost" onClick={() => setForm(EMPTY)}>
                  <X className="mr-2 h-4 w-4" />
                  Cancel
                </Button>
              </div>
            </CardContent>
          </Card>

          <div className="space-y-4">
            <Notice
              icon={Shield}
              tone="text-success"
              title="Security Notice"
              body="All sessions require approval. No permanent access granted. Auto-disconnect on session end."
            />
            <Notice
              icon={Clock}
              tone="text-warning"
              title="Session Limits"
              body="Max 2 hours per session. Auto-terminate after timeout. Extension requires re-approval."
            />
            <Notice
              icon={User}
              tone="text-info"
              title="User Consent"
              body="Target user must explicitly consent before session can start. No silent access allowed."
            />
          </div>
        </div>
      </div>
    </ScrollArea>
  );
}

function Notice({
  icon: Icon,
  tone,
  title,
  body,
}: {
  icon: React.ElementType;
  tone: string;
  title: string;
  body: string;
}) {
  return (
    <Card>
      <CardContent className="flex items-start gap-3 p-4">
        <Icon className={`mt-0.5 h-5 w-5 ${tone}`} />
        <div>
          <p className="text-sm font-medium">{title}</p>
          <p className="mt-1 text-xs text-muted-foreground">{body}</p>
        </div>
      </CardContent>
    </Card>
  );
}

export default AMCreateAssist;
