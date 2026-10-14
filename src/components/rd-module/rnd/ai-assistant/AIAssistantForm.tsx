import { Button } from "@/components/rd-module/ui/button";
import { Card } from "@/components/rd-module/ui/card";
import { Input } from "@/components/rd-module/ui/input";
import { Textarea } from "@/components/rd-module/ui/textarea";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/rd-module/utils";
import type { Capability, FieldValues } from "./capabilities";

interface AIAssistantFormProps {
  capability: Capability;
  values: FieldValues;
  isLoading: boolean;
  onChange: (key: string, value: string) => void;
  onRun: (actionIndex: number) => void;
}

/** Generic input surface driven by the capability config — one form for every AI tool. */
export const AIAssistantForm = ({
  capability,
  values,
  isLoading,
  onChange,
  onRun,
}: AIAssistantFormProps) => {
  const missing = (requires?: string[]) => (requires ?? []).some((key) => !values[key]?.trim());

  return (
    <div className="space-y-4">
      {capability.legend && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {capability.legend.map((entry) => (
            <Card key={entry.label} className={cn("bg-surface-2/50 p-3 text-center", entry.tone)}>
              <p className="text-sm font-semibold">{entry.label}</p>
              <p className="text-xs text-muted-foreground">{entry.hint}</p>
            </Card>
          ))}
        </div>
      )}

      {capability.fields.map((field) => {
        const id = `${capability.id}-${field.key}`;
        const shared = {
          id,
          value: values[field.key] ?? "",
          placeholder: field.placeholder,
          "aria-label": field.label,
          onChange: (event: { target: { value: string } }) =>
            onChange(field.key, event.target.value),
        };
        return field.multiline ? (
          <Textarea key={field.key} {...shared} className="min-h-[110px] bg-surface-2/50" />
        ) : (
          <Input key={field.key} {...shared} className="bg-surface-2/50" />
        );
      })}

      <div className="flex flex-wrap gap-2">
        {capability.actions.map((action, index) => (
          <Button
            key={action.label}
            onClick={() => onRun(index)}
            disabled={isLoading || missing(action.requires)}
            variant={action.variant === "outline" ? "outline" : "default"}
            className={cn(
              "min-h-11 flex-1",
              action.variant !== "outline" && "brand-soft text-foreground",
            )}
          >
            {isLoading ? (
              <Loader2 aria-hidden="true" className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <action.icon aria-hidden="true" className="mr-2 h-4 w-4" />
            )}
            {action.label}
          </Button>
        ))}
      </div>
    </div>
  );
};
