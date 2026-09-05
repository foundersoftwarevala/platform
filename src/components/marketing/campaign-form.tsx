import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { InlineSpinner } from "@/components/marketing/kit";
import type { Row } from "@/lib/marketing/api";

export const CAMPAIGN_CHANNELS = [
  "Google Ads",
  "Meta Ads",
  "Instagram",
  "LinkedIn",
  "YouTube",
  "WhatsApp",
  "SMS",
  "Email",
  "Display",
  "Influencer",
  "SEO",
] as const;

export const CAMPAIGN_OBJECTIVES = [
  "awareness",
  "traffic",
  "engagement",
  "leads",
  "app_installs",
  "sales",
  "retention",
] as const;

export const CAMPAIGN_STATUSES = [
  "draft",
  "pending",
  "scheduled",
  "active",
  "paused",
  "completed",
  "archived",
] as const;

export const CAMPAIGN_REGIONS = [
  "Pan India",
  "North India",
  "South India",
  "West India",
  "East India",
  "Metro Tier 1",
  "Tier 2 & 3",
] as const;

export type CampaignFormValues = {
  code: string;
  name: string;
  channel: string;
  objective: string;
  status: string;
  start_date: string;
  end_date: string;
  budget: number;
  kpi_target: string;
  region: string;
  owner: string;
};

const today = () => new Date().toISOString().slice(0, 10);
const plusDays = (days: number) =>
  new Date(Date.now() + days * 86_400_000).toISOString().slice(0, 10);

export const emptyCampaign = (): CampaignFormValues => ({
  code: `CMP-${Math.random().toString(36).slice(2, 7).toUpperCase()}`,
  name: "",
  channel: CAMPAIGN_CHANNELS[0],
  objective: "leads",
  status: "draft",
  start_date: today(),
  end_date: plusDays(30),
  budget: 100000,
  kpi_target: "",
  region: "Pan India",
  owner: "",
});

export const campaignToForm = (c: Row<"marketing_campaigns">): CampaignFormValues => ({
  code: c.code,
  name: c.name,
  channel: c.channel,
  objective: c.objective,
  status: c.status,
  start_date: c.start_date,
  end_date: c.end_date,
  budget: Number(c.budget),
  kpi_target: c.kpi_target ?? "",
  region: c.region ?? "",
  owner: c.owner ?? "",
});

export function CampaignForm({
  value,
  onChange,
  onSubmit,
  onCancel,
  submitLabel,
  isPending,
}: {
  value: CampaignFormValues;
  onChange: (next: CampaignFormValues) => void;
  onSubmit: () => void;
  onCancel?: () => void;
  submitLabel: string;
  isPending?: boolean;
}) {
  const [error, setError] = useState<string | null>(null);
  const set = <K extends keyof CampaignFormValues>(key: K, v: CampaignFormValues[K]) =>
    onChange({ ...value, [key]: v });

  useEffect(() => {
    setError(null);
  }, [value]);

  const submit = () => {
    if (!value.name.trim()) return setError("Campaign name is required.");
    if (!value.code.trim()) return setError("Campaign code is required.");
    if (new Date(value.end_date) < new Date(value.start_date))
      return setError("End date must be on or after the start date.");
    if (!Number.isFinite(value.budget) || value.budget < 0)
      return setError("Budget must be a positive amount.");
    onSubmit();
  };

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="cf-name">Campaign name</Label>
          <Input
            id="cf-name"
            value={value.name}
            onChange={(e) => set("name", e.target.value)}
            placeholder="Diwali Lead Gen — South"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="cf-code">Campaign code</Label>
          <Input id="cf-code" value={value.code} onChange={(e) => set("code", e.target.value)} />
        </div>

        <div className="space-y-1.5">
          <Label>Channel</Label>
          <Select value={value.channel} onValueChange={(v) => set("channel", v)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {CAMPAIGN_CHANNELS.map((c) => (
                <SelectItem key={c} value={c}>
                  {c}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label>Objective</Label>
          <Select value={value.objective} onValueChange={(v) => set("objective", v)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {CAMPAIGN_OBJECTIVES.map((o) => (
                <SelectItem key={o} value={o} className="capitalize">
                  {o.replace(/_/g, " ")}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label>Status</Label>
          <Select value={value.status} onValueChange={(v) => set("status", v)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {CAMPAIGN_STATUSES.map((s) => (
                <SelectItem key={s} value={s} className="capitalize">
                  {s.replace(/_/g, " ")}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="cf-budget">Budget (₹)</Label>
          <Input
            id="cf-budget"
            type="number"
            min={0}
            value={value.budget}
            onChange={(e) => set("budget", Number(e.target.value))}
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="cf-start">Start date</Label>
          <Input
            id="cf-start"
            type="date"
            value={value.start_date}
            onChange={(e) => set("start_date", e.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="cf-end">End date</Label>
          <Input
            id="cf-end"
            type="date"
            value={value.end_date}
            onChange={(e) => set("end_date", e.target.value)}
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="cf-kpi">KPI target</Label>
          <Input
            id="cf-kpi"
            value={value.kpi_target}
            onChange={(e) => set("kpi_target", e.target.value)}
            placeholder="1,200 qualified leads"
          />
        </div>

        <div className="space-y-1.5">
          <Label>Region</Label>
          <Select value={value.region || "Pan India"} onValueChange={(v) => set("region", v)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {CAMPAIGN_REGIONS.map((r) => (
                <SelectItem key={r} value={r}>
                  {r}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5 sm:col-span-2">
          <Label htmlFor="cf-owner">Owner</Label>
          <Input
            id="cf-owner"
            value={value.owner}
            onChange={(e) => set("owner", e.target.value)}
            placeholder="Growth team lead"
          />
        </div>
      </div>

      {error ? <p className="text-sm text-destructive">{error}</p> : null}

      <div className="flex justify-end gap-2">
        {onCancel ? (
          <Button variant="outline" onClick={onCancel} type="button">
            Cancel
          </Button>
        ) : null}
        <Button onClick={submit} disabled={isPending} type="button">
          {isPending ? <InlineSpinner /> : null}
          <span className={isPending ? "ml-2" : ""}>{submitLabel}</span>
        </Button>
      </div>
    </div>
  );
}
