import type { MouseEventHandler, ReactNode } from "react";

import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";

const NATIVE_CONTEXT_MENU_TARGETS =
  "input, textarea, select, [contenteditable]:not([contenteditable='false']), [role='textbox']";

function preserveEditableContextMenu(target: EventTarget | null): boolean {
  return (
    typeof Element !== "undefined" &&
    target instanceof Element &&
    target.closest(NATIVE_CONTEXT_MENU_TARGETS) !== null
  );
}

export function GlobalContextMenu({ children }: { children: ReactNode }) {
  const handleContextMenuCapture: MouseEventHandler<HTMLDivElement> = (event) => {
    if (preserveEditableContextMenu(event.target)) event.stopPropagation();
  };

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>
        <div className="contents" onContextMenuCapture={handleContextMenuCapture}>
          {children}
        </div>
      </ContextMenuTrigger>
      <ContextMenuContent>
        <ContextMenuItem onSelect={() => window.history.back()}>Go back</ContextMenuItem>
        <ContextMenuItem onSelect={() => window.history.forward()}>Go forward</ContextMenuItem>
        <ContextMenuItem onSelect={() => window.location.reload()}>Reload page</ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  );
}
