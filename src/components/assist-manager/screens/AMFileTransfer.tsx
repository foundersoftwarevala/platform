/**
 * FILE TRANSFER
 * Secure file send/receive backed by assist_file_transfers.
 */

import { useRef, useState } from "react";
import {
  CheckCircle,
  Clock,
  Download,
  File,
  FileDown,
  FileUp,
  Key,
  Trash2,
  Upload,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Progress } from "@/components/ui/progress";
import {
  useCreateTransfer,
  useTransfers,
  useUpdateTransferStatus,
} from "@/lib/assist-manager/hooks";
import {
  CodeChip,
  EmptyState,
  LoadingBlock,
  ScreenHeader,
  formatBytes,
  timeAgo,
  titleCase,
} from "../am-ui";
import { SessionPicker, useActiveSession } from "../am-session";

const TRANSFER_RULES = [
  { id: "send", label: "Send File", icon: Upload, description: "Push files to target device" },
  { id: "receive", label: "Receive File", icon: Download, description: "Pull files from target device" },
  { id: "one_time", label: "One-Time Access", icon: Key, description: "Single use file access link" },
  { id: "auto_delete", label: "Auto Delete", icon: Trash2, description: "Remove files after session ends" },
];

export function AMFileTransfer() {
  const { sessions, session } = useActiveSession();
  const { data: transfers = [], isLoading } = useTransfers();
  const createTransfer = useCreateTransfer();
  const updateTransfer = useUpdateTransferStatus();
  const [direction, setDirection] = useState<"send" | "receive">("send");
  const inputRef = useRef<HTMLInputElement>(null);

  const sessionTransfers = session
    ? transfers.filter((t) => t.session_id === session.id)
    : transfers;

  const onFiles = (files: FileList | null) => {
    if (!files?.length || !session) return;
    Array.from(files).forEach((file) =>
      createTransfer.mutate({
        sessionId: session.id,
        fileName: file.name,
        sizeBytes: file.size,
        direction,
      }),
    );
    if (inputRef.current) inputRef.current.value = "";
  };

  return (
    <ScrollArea className="h-full">
      <div className="space-y-6 p-6">
        <ScreenHeader
          title="File Transfer"
          subtitle="Secure file exchange during assist sessions"
          actions={<SessionPicker sessions={sessions} value={session?.id} />}
        />

        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          {TRANSFER_RULES.map((rule) => {
            const Icon = rule.icon;
            const selectable = rule.id === "send" || rule.id === "receive";
            const active = selectable && direction === rule.id;
            return (
              <Card
                key={rule.id}
                onClick={() => selectable && setDirection(rule.id as "send" | "receive")}
                className={
                  selectable
                    ? `cursor-pointer transition-colors ${active ? "border-primary glow-ring" : "hover:border-primary/50"}`
                    : "border-border/60"
                }
              >
                <CardContent className="p-4 text-center">
                  <Icon className={`mx-auto mb-2 h-8 w-8 ${active ? "text-primary" : "text-muted-foreground"}`} />
                  <p className="text-sm font-medium">{rule.label}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{rule.description}</p>
                </CardContent>
              </Card>
            );
          })}
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <FileUp className="h-5 w-5" />
              Transfer Queue
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <LoadingBlock rows={3} />
            ) : sessionTransfers.length === 0 ? (
              <EmptyState
                title="No transfers"
                description="Queue a file below to start a secure, auto-deleting transfer."
              />
            ) : (
              <div className="space-y-4">
                {sessionTransfers.map((file) => (
                  <div key={file.id} className="flex items-center gap-4 rounded-lg bg-muted/50 p-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                      {file.direction === "send" ? (
                        <FileUp className="h-5 w-5 text-primary" />
                      ) : (
                        <FileDown className="h-5 w-5 text-info" />
                      )}
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <File className="h-4 w-4" />
                        <span className="truncate text-sm font-medium">{file.file_name}</span>
                        <span className="text-xs text-muted-foreground">
                          ({formatBytes(file.size_bytes)})
                        </span>
                        <CodeChip>{file.transfer_code}</CodeChip>
                      </div>
                      {file.status === "in_progress" && (
                        <div className="mt-2">
                          <Progress value={file.progress} className="h-1" />
                          <p className="mt-1 text-xs text-muted-foreground">
                            {file.progress}% complete
                          </p>
                        </div>
                      )}
                    </div>

                    <div className="flex items-center gap-3">
                      {file.status === "pending" && (
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={updateTransfer.isPending}
                          onClick={() =>
                            updateTransfer.mutate({ id: file.id, status: "in_progress", progress: 10 })
                          }
                        >
                          Start
                        </Button>
                      )}
                      {file.status === "in_progress" && (
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={updateTransfer.isPending}
                          onClick={() =>
                            updateTransfer.mutate({ id: file.id, status: "completed", progress: 100 })
                          }
                        >
                          Complete
                        </Button>
                      )}
                      <div className="text-right">
                        <Badge
                          variant={
                            file.status === "completed"
                              ? "default"
                              : file.status === "in_progress"
                                ? "secondary"
                                : "outline"
                          }
                        >
                          {file.status === "completed" && <CheckCircle className="mr-1 h-3 w-3" />}
                          {file.status === "in_progress" && <Clock className="mr-1 h-3 w-3" />}
                          {titleCase(file.status)}
                        </Badge>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {timeAgo(file.created_at)}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="border-success/40 bg-success/5">
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              <Trash2 className="mt-0.5 h-5 w-5 text-success" />
              <div>
                <p className="text-sm font-medium">Auto-Delete Enabled</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  All transferred files are automatically deleted after the session ends. No file
                  persistence on any device. One-time access only.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <input
              ref={inputRef}
              type="file"
              multiple
              className="hidden"
              onChange={(e) => onFiles(e.target.files)}
            />
            <div
              className="rounded-lg border-2 border-dashed border-border p-8 text-center"
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                onFiles(e.dataTransfer.files);
              }}
            >
              <Upload className="mx-auto mb-4 h-12 w-12 text-muted-foreground" />
              <p className="font-medium">Drop files here or click to upload</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Queued as a <span className="font-medium">{direction}</span> transfer
                {session ? ` on ${session.session_code}` : ""} • auto-delete after session
              </p>
              <Button
                className="mt-4"
                disabled={!session || createTransfer.isPending}
                onClick={() => inputRef.current?.click()}
              >
                <Upload className="mr-2 h-4 w-4" />
                {session ? "Select Files" : "No live session"}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </ScrollArea>
  );
}

export default AMFileTransfer;
