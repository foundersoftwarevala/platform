import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Bot, Brain, Zap } from "lucide-react";
import { Badge } from "@/components/rd-module/ui/badge";
import { Card } from "@/components/rd-module/ui/card";
import { useRnDAI } from "@/hooks/rd-module/useRnDAI";
import { cn } from "@/lib/rd-module/utils";
import { AIAssistantChat, type ChatMessage } from "./ai-assistant/AIAssistantChat";
import { AIAssistantForm } from "./ai-assistant/AIAssistantForm";
import { AIAssistantResult } from "./ai-assistant/AIAssistantResult";
import { CHAT_CAPABILITY_ID, capabilities, type FieldValues } from "./ai-assistant/capabilities";

/**
 * Shell for the R&D AI command center: owns capability selection and shared
 * state, and delegates rendering to the chat, form and result components.
 */
export const AIRnDAssistant = () => {
  const api = useRnDAI();
  const [activeId, setActiveId] = useState<string>(CHAT_CAPABILITY_ID);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [values, setValues] = useState<Record<string, FieldValues>>({});
  const [results, setResults] = useState<Record<string, string | null>>({});

  const active = capabilities.find((entry) => entry.id === activeId) ?? capabilities[0]!;
  const activeValues = values[active.id] ?? {};

  const setField = (key: string, value: string) =>
    setValues((prev) => ({ ...prev, [active.id]: { ...(prev[active.id] ?? {}), [key]: value } }));

  const runAction = async (index: number) => {
    const action = active.actions[index];
    if (!action) return;
    const result = await action.run(api, activeValues);
    setResults((prev) => ({ ...prev, [active.id]: result }));
  };

  const sendChat = async (message: string) => {
    setMessages((prev) => [...prev, { role: "user", content: message }]);
    const reply = await api.chat(message, "R&D Assistant");
    if (reply) setMessages((prev) => [...prev, { role: "assistant", content: reply }]);
  };

  return (
    <div className="space-y-6">
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4 sm:flex sm:justify-between"
      >
        <div className="flex min-w-0 items-center gap-4">
          <div className="brand-soft grid h-14 w-14 shrink-0 place-items-center rounded-2xl border border-brand/30">
            <Brain aria-hidden="true" className="h-7 w-7 text-brand" />
          </div>
          <div className="min-w-0">
            <h2 className="brand-gradient-text truncate text-xl font-bold sm:text-2xl">
              AI R&amp;D Command Center
            </h2>
            <p className="text-sm text-muted-foreground">
              15 AI-powered capabilities for innovation
            </p>
          </div>
        </div>
        <Badge variant="outline" className="shrink-0 border-success/40 text-success">
          <Zap aria-hidden="true" className="mr-1 h-3 w-3" />
          Neural engine active
        </Badge>
      </motion.div>

      <div className="grid gap-6 lg:grid-cols-12">
        <div className="lg:col-span-4">
          <Card className="panel p-4">
            <h3 className="mb-4 flex items-center gap-2 text-sm font-semibold text-brand">
              <Bot aria-hidden="true" className="h-4 w-4" />
              AI capabilities
            </h3>
            <nav aria-label="AI capabilities" className="space-y-2">
              {capabilities.map((capability, index) => {
                const isActive = capability.id === active.id;
                return (
                  <motion.button
                    key={capability.id}
                    type="button"
                    onClick={() => setActiveId(capability.id)}
                    aria-current={isActive ? "true" : undefined}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.05 }}
                    className={cn(
                      "flex min-h-11 w-full items-center gap-3 rounded-xl px-4 py-3 text-sm transition-colors",
                      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                      isActive
                        ? "brand-soft border border-brand/40 text-foreground"
                        : "text-muted-foreground hover:bg-surface-2/60 hover:text-foreground",
                    )}
                  >
                    <capability.icon
                      aria-hidden="true"
                      className={cn("h-4 w-4", isActive && "text-brand")}
                    />
                    <span>{capability.label}</span>
                  </motion.button>
                );
              })}
            </nav>
          </Card>
        </div>

        <div className="lg:col-span-8">
          <Card className="panel min-h-[600px] p-4 sm:p-6">
            <AnimatePresence mode="wait">
              <motion.div
                key={active.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="flex h-full flex-col space-y-4"
              >
                <div>
                  <h3 className="flex items-center gap-2 text-lg font-semibold text-foreground">
                    <active.icon aria-hidden="true" className="h-5 w-5 text-brand" />
                    {active.title}
                  </h3>
                  <p className="text-sm text-muted-foreground">{active.description}</p>
                </div>

                {active.id === CHAT_CAPABILITY_ID ? (
                  <AIAssistantChat
                    messages={messages}
                    isLoading={api.isLoading}
                    onSend={sendChat}
                  />
                ) : (
                  <>
                    <AIAssistantForm
                      capability={active}
                      values={activeValues}
                      isLoading={api.isLoading}
                      onChange={setField}
                      onRun={runAction}
                    />
                    <AIAssistantResult result={results[active.id] ?? null} />
                  </>
                )}
              </motion.div>
            </AnimatePresence>
          </Card>
        </div>
      </div>
    </div>
  );
};
