import { useEffect, useRef, useState } from "react";
import { Camera, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { updateMyProfile } from "@/services/chat/chat-service";
import { uploadToBucket } from "@/services/chat/upload";
import type { Profile } from "@/services/chat/types";
import { UserAvatar } from "./media";
import { useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "@/lib/i18n/use-translation";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId: string;
  profile: Profile | null;
}

/** Edit own identity: display name, handle, job title and profile photo. */
export function ProfileDialog({ open, onOpenChange, userId, profile }: Props) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [displayName, setDisplayName] = useState(profile?.display_name ?? "");
  const [handle, setHandle] = useState(profile?.handle ?? "");
  const [jobTitle, setJobTitle] = useState(profile?.job_title ?? "");
  const [avatarPath, setAvatarPath] = useState<string | null>(profile?.avatar_path ?? null);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open && profile) {
      setDisplayName(profile.display_name);
      setHandle(profile.handle);
      setJobTitle(profile.job_title ?? "");
      setAvatarPath(profile.avatar_path);
    }
  }, [open, profile]);

  const uploadAvatar = async (file: File) => {
    setUploading(true);
    try {
      const safe = file.name.replace(/[^\w.\-]+/g, "_");
      const path = `${userId}/avatar-${Date.now()}-${safe}`;
      const handleUpload = uploadToBucket({ bucket: "avatars", path, file });
      await handleUpload.promise;
      setAvatarPath(path);
      toast.success(t("chat.profile.photo_uploaded"));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("chat.profile.photo_failed"));
    } finally {
      setUploading(false);
    }
  };

  const save = async () => {
    const cleanHandle = handle.trim().toLowerCase().replace(/[^a-z0-9_-]+/g, "-");
    if (!displayName.trim() || !cleanHandle) {
      toast.error(t("chat.profile.required"));
      return;
    }
    setSaving(true);
    try {
      await updateMyProfile(userId, {
        display_name: displayName.trim(),
        handle: cleanHandle,
        job_title: jobTitle.trim() || null,
        avatar_path: avatarPath,
      });
      await queryClient.invalidateQueries({ queryKey: ["profile", userId] });
      await queryClient.invalidateQueries({ queryKey: ["conversations", userId] });
      toast.success(t("chat.profile.updated"));
      onOpenChange(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("chat.profile.save_failed"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{t("chat.header.my_profile")}</DialogTitle>
          <DialogDescription>{t("chat.profile.description")}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex items-center gap-4">
            <div className="relative">
              <UserAvatar name={displayName || "?"} avatarPath={avatarPath} className="size-16" />
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                aria-label={t("chat.profile.change_photo")}
                className="absolute -bottom-1 -right-1 grid size-7 place-items-center rounded-full border border-border bg-secondary shadow-sm hover:bg-accent"
              >
                {uploading ? <Loader2 className="size-3.5 animate-spin" /> : <Camera className="size-3.5" />}
              </button>
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                className="hidden"
                aria-label={t("chat.profile.upload_photo")}
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) void uploadAvatar(file);
                  e.target.value = "";
                }}
              />
            </div>
            <p className="text-xs text-muted-foreground">
              {t("chat.profile.photo_hint")}
            </p>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="profile-name">{t("chat.profile.display_name")}</Label>
            <Input
              id="profile-name"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              maxLength={80}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="profile-handle">{t("chat.profile.handle")}</Label>
            <Input
              id="profile-handle"
              value={handle}
              onChange={(e) => setHandle(e.target.value)}
              maxLength={40}
              placeholder={t("chat.profile.handle_placeholder")}
            />
            <p className="text-xs text-muted-foreground">{t("chat.profile.handle_hint")}</p>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="profile-title">{t("chat.profile.job_title")}</Label>
            <Input
              id="profile-title"
              value={jobTitle}
              onChange={(e) => setJobTitle(e.target.value)}
              maxLength={80}
              placeholder={t("chat.profile.job_title_placeholder")}
            />
          </div>

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              {t("chat.cancel")}
            </Button>
            <Button onClick={() => void save()} disabled={saving || uploading}>
              {saving ? <Loader2 className="size-4 animate-spin" /> : null}
              {t("chat.profile.save")}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
