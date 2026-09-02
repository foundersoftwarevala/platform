import { useEffect, useState } from "react";
import { Download, FileText, Loader2, Play } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { createSignedUrl } from "@/services/chat/chat-service";
import { formatBytes, type Attachment } from "@/services/chat/types";
import { cn } from "@/lib/utils";

/** Signed URL resolver for private storage objects, refreshed before expiry. */
export function useSignedUrl(bucket: string, path: string | null | undefined) {
  const [url, setUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!path) {
      setUrl(null);
      return;
    }
    let active = true;
    const load = async () => {
      try {
        const signed = await createSignedUrl(bucket, path);
        if (active) {
          setUrl(signed);
          setError(null);
        }
      } catch (err) {
        if (active) setError(err instanceof Error ? err.message : "Could not load file");
      }
    };
    void load();
    const timer = window.setInterval(load, 4 * 60 * 1000);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [bucket, path]);

  return { url, error };
}

export function UserAvatar({
  name,
  avatarPath,
  className,
  presence,
}: {
  name: string;
  avatarPath?: string | null | undefined;
  className?: string | undefined;
  presence?: string | undefined;
}) {
  const { url } = useSignedUrl("avatars", avatarPath ?? null);
  const initials = name
    .split(" ")
    .map((part) => part[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <span className="relative inline-flex shrink-0">
      <Avatar className={cn("size-10 border border-border/70", className)}>
        {url ? <AvatarImage src={url} alt={`${name} profile photo`} /> : null}
        <AvatarFallback className="bg-secondary text-xs font-semibold">{initials || "?"}</AvatarFallback>
      </Avatar>
      {presence ? (
        <span
          aria-label={`${name} is ${presence}`}
          className={cn(
            "absolute -bottom-0.5 -right-0.5 size-3 rounded-full border-2 border-background",
            presence === "online" ? "bg-emerald-500" : presence === "away" ? "bg-amber-500" : "bg-muted-foreground",
          )}
        />
      ) : null}
    </span>
  );
}

export function AttachmentCard({ attachment }: { attachment: Attachment }) {
  const { url, error } = useSignedUrl("chat-files", attachment.storage_path);
  const [downloading, setDownloading] = useState(false);

  const download = async () => {
    setDownloading(true);
    try {
      const signed = await createSignedUrl("chat-files", attachment.storage_path, attachment.file_name);
      window.open(signed, "_blank", "noopener");
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className="mt-2 overflow-hidden rounded-xl border border-border/70 bg-background/40">
      {attachment.media_kind === "image" && url ? (
        <img
          src={url}
          alt={attachment.file_name}
          loading="lazy"
          className="max-h-72 w-full object-cover"
        />
      ) : null}
      {attachment.media_kind === "video" && url ? (
        <video src={url} controls preload="metadata" className="max-h-72 w-full bg-black" />
      ) : null}
      {(attachment.media_kind === "audio" || attachment.media_kind === "voice") && url ? (
        <audio src={url} controls preload="metadata" className="w-full px-3 py-2" />
      ) : null}

      <div className="flex items-center gap-3 px-3 py-2">
        <span className="grid size-8 place-items-center rounded-lg bg-secondary text-secondary-foreground">
          {attachment.media_kind === "video" ? <Play className="size-4" /> : <FileText className="size-4" />}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-medium">{attachment.file_name}</span>
          <span className="block text-xs text-muted-foreground">
            {formatBytes(attachment.size_bytes)} · {attachment.mime_type || "file"}
          </span>
        </span>
        <Button
          type="button"
          size="icon"
          variant="ghost"
          aria-label={`Download ${attachment.file_name}`}
          onClick={() => void download()}
          disabled={downloading}
        >
          {downloading ? <Loader2 className="size-4 animate-spin" /> : <Download className="size-4" />}
        </Button>
      </div>
      {error ? <p className="px-3 pb-2 text-xs text-destructive">{error}</p> : null}
    </div>
  );
}
