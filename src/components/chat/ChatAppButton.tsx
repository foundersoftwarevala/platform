import { Link } from "@tanstack/react-router";
import { MessageSquare } from "lucide-react";
import { useMyPermissions, useSupabaseSession } from "@/hooks/use-session";
import { useTranslation } from "@/lib/i18n/use-translation";
import { cn } from "@/lib/utils";

/**
 * The internal chat (Connect Chat, /chat) from any top bar.
 *
 * Shown to a signed-in person whose role may send messages - the same
 * message.send permission the chat itself enforces, and the one Chat Manager's
 * Role Access Matrix grants or withdraws per role (role_permissions). Taking
 * the permission away in Chat Manager removes this button everywhere; nothing
 * about it is decided here.
 */
export function ChatAppButton({
  className,
  iconClassName = "h-4 w-4",
  label,
}: {
  /** The top bar's own icon-button style, so it sits among its neighbours. */
  className?: string;
  iconClassName?: string;
  /** Text beside the icon (hidden on small screens), for bars that label buttons. */
  label?: string;
}) {
  const { t } = useTranslation();
  const { userId } = useSupabaseSession();
  const { can, isSuccess } = useMyPermissions(userId);
  if (!userId || !isSuccess || !can("message.send")) return null;
  return (
    <Link
      to="/chat"
      aria-label={t("chat.app_button.open")}
      title={t("chat.app_button.label")}
      data-chat-app-button
      className={cn(
        className ??
          "relative grid h-9 w-9 place-items-center rounded-full border border-border text-muted-foreground transition-colors hover:text-foreground",
      )}
    >
      <MessageSquare className={iconClassName} aria-hidden="true" />
      {label && <span className="hidden md:inline">{label}</span>}
    </Link>
  );
}
