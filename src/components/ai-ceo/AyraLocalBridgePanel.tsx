import { useCallback, useEffect, useRef, useState } from "react";
import { CheckCircle2, CircleAlert, Code2, Link2Off, Loader2, Play, Unplug } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const BRIDGE_URL = "ws://127.0.0.1:50001/bridge";

type BridgeStatus = "disconnected" | "connecting" | "authenticating" | "connected" | "error";
type BridgeAction = "open_vscode" | "read_file" | "run_command";
type PendingRequest = {
  resolve: (value: unknown) => void;
  reject: (error: Error) => void;
  timer: ReturnType<typeof setTimeout>;
};

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Local PC action failed.";
}

export function AyraLocalBridgePanel() {
  const [token, setToken] = useState("");
  const [status, setStatus] = useState<BridgeStatus>("disconnected");
  const [error, setError] = useState("");
  const [filePath, setFilePath] = useState("");
  const [output, setOutput] = useState("");
  const [busy, setBusy] = useState(false);
  const socket = useRef<WebSocket | null>(null);
  const pending = useRef(new Map<string, PendingRequest>());

  const rejectPending = useCallback((message: string) => {
    for (const [id, request] of pending.current) {
      clearTimeout(request.timer);
      request.reject(new Error(message));
      pending.current.delete(id);
    }
  }, []);

  const disconnect = useCallback(() => {
    socket.current?.close(1000, "Disconnected by user");
    socket.current = null;
    rejectPending("Local PC bridge disconnected.");
    setStatus("disconnected");
  }, [rejectPending]);

  useEffect(
    () => () => {
      socket.current?.close(1000, "AYRA panel closed");
      rejectPending("AYRA panel closed.");
    },
    [rejectPending],
  );

  const connect = useCallback(() => {
    const pairingToken = token.trim();
    if (new TextEncoder().encode(pairingToken).length < 32) {
      setError("Enter the 32-byte pairing token shown when the local bridge starts.");
      return;
    }
    disconnect();
    setError("");
    setOutput("");
    setStatus("connecting");
    const ws = new WebSocket(BRIDGE_URL, "ayra-local-v1");
    socket.current = ws;

    ws.addEventListener("open", () => {
      if (socket.current !== ws) return;
      setStatus("authenticating");
      ws.send(JSON.stringify({ type: "authenticate", token: pairingToken }));
    });
    ws.addEventListener("message", (event) => {
      if (socket.current !== ws || typeof event.data !== "string") return;
      let message: { type?: string; ok?: boolean; id?: string; result?: unknown; error?: string };
      try {
        message = JSON.parse(event.data) as typeof message;
      } catch {
        setError("The local bridge returned an invalid response.");
        return;
      }
      if (message.type === "authenticated") {
        if (message.ok) {
          setStatus("connected");
          setError("");
        } else {
          setStatus("error");
          setError(message.error || "Pairing token rejected.");
          ws.close(4003, "Pairing failed");
        }
        return;
      }
      if (message.type !== "response" || !message.id) return;
      const request = pending.current.get(message.id);
      if (!request) return;
      clearTimeout(request.timer);
      pending.current.delete(message.id);
      if (message.ok) request.resolve(message.result);
      else request.reject(new Error(message.error || "Local PC action failed."));
    });
    ws.addEventListener("error", () => {
      if (socket.current === ws) {
        setStatus("error");
        setError(
          "Could not reach the local bridge. Confirm it is running on this PC and the browser allowed local-network access.",
        );
      }
    });
    ws.addEventListener("close", () => {
      if (socket.current === ws) {
        socket.current = null;
        setStatus((current) => (current === "error" ? current : "disconnected"));
        rejectPending("Local PC bridge disconnected.");
      }
    });
  }, [disconnect, rejectPending, token]);

  const request = useCallback(
    (action: BridgeAction, params: Record<string, string>) => {
      const ws = socket.current;
      if (!ws || ws.readyState !== WebSocket.OPEN || status !== "connected") {
        return Promise.reject(new Error("Connect to the local PC bridge first."));
      }
      const id = crypto.randomUUID();
      return new Promise<unknown>((resolve, reject) => {
        const timer = setTimeout(() => {
          pending.current.delete(id);
          reject(new Error("The local PC action timed out."));
        }, 15_000);
        pending.current.set(id, { resolve, reject, timer });
        ws.send(JSON.stringify({ type: "request", id, action, params }));
      });
    },
    [status],
  );

  const perform = useCallback(
    async (action: BridgeAction, params: Record<string, string>) => {
      setBusy(true);
      setError("");
      try {
        const result = await request(action, params);
        setOutput(JSON.stringify(result, null, 2));
      } catch (reason) {
        setError(errorMessage(reason));
      } finally {
        setBusy(false);
      }
    },
    [request],
  );

  const connected = status === "connected";
  const statusLabel = connected
    ? "Connected to Local PC"
    : status === "connecting" || status === "authenticating"
      ? "Connecting to Local PC…"
      : "Local PC disconnected";
  const StatusIcon = connected
    ? CheckCircle2
    : status === "error"
      ? CircleAlert
      : status === "connecting" || status === "authenticating"
        ? Loader2
        : Link2Off;

  return (
    <Card className="mx-4 my-4 border-primary/25 md:mx-8">
      <CardHeader className="pb-3">
        <CardTitle className="flex flex-wrap items-center justify-between gap-3 text-base">
          <span className="flex items-center gap-2">
            <Code2 className="h-5 w-5 text-primary" /> AYRA Local PC Bridge
          </span>
          <span
            className={`flex items-center gap-1.5 text-xs ${connected ? "text-emerald-500" : status === "error" ? "text-destructive" : "text-muted-foreground"}`}
            role="status"
          >
            <StatusIcon
              className={`h-4 w-4 ${status === "connecting" || status === "authenticating" ? "animate-spin" : ""}`}
            />
            {statusLabel}
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-xs text-muted-foreground">
          Pair this browser with the opt-in loopback agent running on your own PC. It can open VS
          Code, read selected source files, and run only read-only Git status/history commands. It
          cannot run arbitrary shell commands or change files.
        </p>
        {!connected && (
          <form
            className="flex flex-col gap-2 sm:flex-row"
            onSubmit={(event) => {
              event.preventDefault();
              connect();
            }}
          >
            <label className="sr-only" htmlFor="ayra-local-bridge-token">
              Local bridge pairing token
            </label>
            <input
              id="ayra-local-bridge-token"
              type="password"
              autoComplete="off"
              value={token}
              onChange={(event) => setToken(event.target.value)}
              placeholder="Paste local pairing token"
              className="min-w-0 flex-1 rounded-md border border-border bg-background px-3 py-2 text-sm"
            />
            <Button
              type="submit"
              disabled={
                status === "connecting" ||
                status === "authenticating" ||
                new TextEncoder().encode(token.trim()).length < 32
              }
            >
              {status === "connecting" || status === "authenticating" ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Link2Off className="mr-2 h-4 w-4" />
              )}
              Connect
            </Button>
          </form>
        )}
        {connected && (
          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              variant="secondary"
              disabled={busy}
              onClick={() => void perform("open_vscode", {})}
            >
              <Code2 className="mr-1.5 h-4 w-4" /> Open VS Code
            </Button>
            <Button
              size="sm"
              variant="secondary"
              disabled={busy}
              onClick={() => void perform("run_command", { command: "git_status" })}
            >
              <Play className="mr-1.5 h-4 w-4" /> Git status
            </Button>
            <Button
              size="sm"
              variant="secondary"
              disabled={busy}
              onClick={() => void perform("run_command", { command: "git_recent" })}
            >
              <Play className="mr-1.5 h-4 w-4" /> Recent commits
            </Button>
            <Button size="sm" variant="ghost" onClick={disconnect}>
              <Unplug className="mr-1.5 h-4 w-4" /> Disconnect
            </Button>
            <form
              className="flex w-full gap-2"
              onSubmit={(event) => {
                event.preventDefault();
                void perform("read_file", { path: filePath.trim() });
              }}
            >
              <label className="sr-only" htmlFor="ayra-local-bridge-file">
                Relative source file path
              </label>
              <input
                id="ayra-local-bridge-file"
                value={filePath}
                onChange={(event) => setFilePath(event.target.value)}
                placeholder="Relative source path, e.g. src/App.tsx"
                className="min-w-0 flex-1 rounded-md border border-border bg-background px-3 py-2 text-sm"
              />
              <Button type="submit" size="sm" disabled={busy || !filePath.trim()}>
                {busy ? "Reading…" : "Read file"}
              </Button>
            </form>
          </div>
        )}
        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}
        {output && (
          <pre className="max-h-64 overflow-auto rounded-md border border-border bg-muted/30 p-3 text-xs">
            {output}
          </pre>
        )}
      </CardContent>
    </Card>
  );
}
