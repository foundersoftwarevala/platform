import { Card } from "@/components/rd-module/ui/card";
import { ScrollArea } from "@/components/rd-module/ui/scroll-area";

/** Renders the raw markdown-ish AI answer for any capability. */
export const AIAssistantResult = ({ result }: { result: string | null }) => {
  if (!result) return null;

  return (
    <ScrollArea className="mt-4 h-[300px]">
      <Card className="border-border bg-surface-2/60 p-4">
        <p className="whitespace-pre-wrap text-sm text-foreground">{result}</p>
      </Card>
    </ScrollArea>
  );
};
