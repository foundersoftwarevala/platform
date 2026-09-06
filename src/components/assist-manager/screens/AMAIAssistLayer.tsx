/**
 * AI ASSIST LAYER
 * AI can suggest, detect, guide — it can never execute or bypass approval.
 */

import {
  Brain,
  CheckCircle2,
  FileText,
  Hand,
  Languages,
  Lightbulb,
  Lock,
  MessageSquare,
  Search,
  ShieldX,
  XCircle,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { useDecideSuggestion, useSessions, useSuggestions } from "@/lib/assist-manager/hooks";
import { CodeChip, EmptyState, LoadingBlock, ScreenHeader, timeAgo, titleCase } from "../am-ui";

const AI_CAPABILITIES = [
  { id: "suggest", label: "Suggest Fix", icon: Lightbulb, description: "Recommend solutions based on detected issues" },
  { id: "detect", label: "Detect Issue", icon: Search, description: "Identify problems and anomalies" },
  { id: "guide", label: "Guide Human", icon: MessageSquare, description: "Provide step-by-step assistance" },
  { id: "translate", label: "Translate Chat", icon: Languages, description: "Real-time language translation" },
  { id: "summarize", label: "Summarize Session", icon: FileText, description: "Generate session summary report" },
];

const AI_RESTRICTIONS = [
  { id: "control", label: "Take Control", icon: Hand, description: "AI cannot take control of session" },
  { id: "execute", label: "Execute Actions", icon: ShieldX, description: "AI cannot execute any actions" },
  { id: "bypass", label: "Bypass Approval", icon: Lock, description: "AI cannot bypass approval flow" },
];

export function AMAIAssistLayer() {
  const { data: suggestions = [], isLoading } = useSuggestions();
  const { data: sessions = [] } = useSessions();
  const decide = useDecideSuggestion();

  const open = suggestions.filter((s) => s.status === "open");
  const codeFor = (sessionId: string | null) =>
    sessions.find((s) => s.id === sessionId)?.session_code;

  return (
    <ScrollArea className="h-full">
      <div className="space-y-6 p-6">
        <ScreenHeader
          title="AI Assist Layer"
          subtitle="AI-powered assistance — suggest only, never execute"
          actions={
            <Badge variant="secondary" className="gap-1">
              <Brain className="h-4 w-4" />
              Assist Only Mode
            </Badge>
          }
        />

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base text-success">
                <CheckCircle2 className="h-5 w-5" />
                AI Can
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {AI_CAPABILITIES.map((cap) => {
                const Icon = cap.icon;
                return (
                  <div key={cap.id} className="flex items-center gap-3 rounded-lg bg-success/10 p-3">
                    <Icon className="h-5 w-5 text-success" />
                    <div className="flex-1">
                      <p className="text-sm font-medium">{cap.label}</p>
                      <p className="text-xs text-muted-foreground">{cap.description}</p>
                    </div>
                    <Badge variant="outline" className="border-success/40 text-success">
                      Allowed
                    </Badge>
                  </div>
                );
              })}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base text-destructive">
                <XCircle className="h-5 w-5" />
                AI Cannot
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {AI_RESTRICTIONS.map((res) => {
                const Icon = res.icon;
                return (
                  <div
                    key={res.id}
                    className="flex items-center gap-3 rounded-lg bg-destructive/10 p-3"
                  >
                    <Icon className="h-5 w-5 text-destructive" />
                    <div className="flex-1">
                      <p className="text-sm font-medium">{res.label}</p>
                      <p className="text-xs text-muted-foreground">{res.description}</p>
                    </div>
                    <Badge variant="destructive">Blocked</Badge>
                  </div>
                );
              })}
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Lightbulb className="h-5 w-5" />
              Live AI Suggestions
              <Badge variant="secondary" className="ml-1">
                {open.length} open
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {isLoading ? (
              <LoadingBlock rows={3} />
            ) : suggestions.length === 0 ? (
              <EmptyState
                title="No suggestions"
                description="AI suggestions raised during sessions will appear here for human review."
              />
            ) : (
              suggestions.map((suggestion) => (
                <div
                  key={suggestion.id}
                  className="flex items-start gap-4 rounded-lg border border-primary/25 bg-primary/5 p-4"
                >
                  <Brain className="mt-0.5 h-5 w-5 text-primary" />
                  <div className="flex-1">
                    <div className="mb-1 flex flex-wrap items-center gap-2">
                      <Badge variant="outline" className="text-xs">
                        {titleCase(suggestion.suggestion_type)}
                      </Badge>
                      <CodeChip>{suggestion.suggestion_code}</CodeChip>
                      {codeFor(suggestion.session_id) && (
                        <CodeChip>{codeFor(suggestion.session_id)}</CodeChip>
                      )}
                      <span className="ml-auto text-xs text-primary">
                        {suggestion.confidence}% confidence
                      </span>
                    </div>
                    <p className="text-sm">{suggestion.message}</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {timeAgo(suggestion.created_at)}
                    </p>
                  </div>
                  {suggestion.status === "open" ? (
                    <div className="flex flex-col gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={decide.isPending}
                        onClick={() => decide.mutate({ id: suggestion.id, status: "accepted" })}
                      >
                        Accept
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        disabled={decide.isPending}
                        onClick={() => decide.mutate({ id: suggestion.id, status: "dismissed" })}
                      >
                        Dismiss
                      </Button>
                    </div>
                  ) : (
                    <Badge
                      variant={suggestion.status === "accepted" ? "default" : "secondary"}
                      className="capitalize"
                    >
                      {suggestion.status}
                    </Badge>
                  )}
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Card className="border-primary/40 bg-primary/5">
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              <Brain className="mt-0.5 h-5 w-5 text-primary" />
              <div>
                <p className="text-sm font-medium text-primary">AI Assist Principle</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  AI is a helper, not a controller. Every suggestion requires human approval before
                  any action. AI cannot execute commands, take control or bypass security measures.
                  The final decision always rests with the human operator.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </ScrollArea>
  );
}

export default AMAIAssistLayer;
