/**
 * Shared UX primitives for the Developer Manager module.
 * - InfoHint: inline help tooltip
 * - ReadOnlyTag / EditableTag: affordance indicators
 * - ConfirmAction: destructive-action confirmation wrapper
 * - Pager: lightweight list pagination
 */
import React, { useState } from 'react';
import { HelpCircle, Lock, Pencil, ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';

export const InfoHint: React.FC<{ text: string; label?: string }> = ({ text, label }) => (
  <TooltipProvider delayDuration={150}>
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          aria-label={label ?? `Help: ${text}`}
          className="inline-flex h-5 w-5 items-center justify-center rounded-full text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <HelpCircle className="h-3.5 w-3.5" />
        </button>
      </TooltipTrigger>
      <TooltipContent className="max-w-xs text-xs leading-relaxed">{text}</TooltipContent>
    </Tooltip>
  </TooltipProvider>
);

/** Wraps any trigger with a tooltip (used for disabled-state explanations). */
export const Hint: React.FC<{ text: string; children: React.ReactNode }> = ({ text, children }) => (
  <TooltipProvider delayDuration={150}>
    <Tooltip>
      <TooltipTrigger asChild>
        <span className="inline-flex">{children}</span>
      </TooltipTrigger>
      <TooltipContent className="max-w-xs text-xs leading-relaxed">{text}</TooltipContent>
    </Tooltip>
  </TooltipProvider>
);

export const ReadOnlyTag: React.FC<{ note?: string }> = ({ note }) => (
  <span className="inline-flex items-center gap-1 rounded-full border border-border bg-muted/60 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
    <Lock className="h-3 w-3" />
    Read only
    {note && <span className="normal-case tracking-normal">· {note}</span>}
  </span>
);

export const EditableTag: React.FC<{ note?: string }> = ({ note }) => (
  <span className="inline-flex items-center gap-1 rounded-full border border-primary/30 bg-primary/10 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-primary">
    <Pencil className="h-3 w-3" />
    Editable
    {note && <span className="normal-case tracking-normal">· {note}</span>}
  </span>
);

interface ConfirmActionProps {
  title: string;
  description: string;
  confirmLabel?: string;
  onConfirm: () => void;
  children: React.ReactNode;
}

export const ConfirmAction: React.FC<ConfirmActionProps> = ({
  title,
  description,
  confirmLabel = 'Confirm',
  onConfirm,
  children,
}) => (
  <AlertDialog>
    <AlertDialogTrigger asChild>{children}</AlertDialogTrigger>
    <AlertDialogContent>
      <AlertDialogHeader>
        <AlertDialogTitle>{title}</AlertDialogTitle>
        <AlertDialogDescription>{description}</AlertDialogDescription>
      </AlertDialogHeader>
      <AlertDialogFooter>
        <AlertDialogCancel>Cancel</AlertDialogCancel>
        <AlertDialogAction onClick={onConfirm}>{confirmLabel}</AlertDialogAction>
      </AlertDialogFooter>
    </AlertDialogContent>

  </AlertDialog>
);

/** Client-side pagination helper. */
export function usePager<T>(items: T[], pageSize = 8) {
  const [page, setPage] = useState(1);
  const lastPage = Math.max(1, Math.ceil(items.length / pageSize));
  const current = Math.min(page, lastPage);
  const slice = items.slice((current - 1) * pageSize, current * pageSize);
  return { page: current, lastPage, slice, setPage, total: items.length, pageSize };
}

export const Pager: React.FC<{
  page: number;
  lastPage: number;
  total: number;
  onChange: (page: number) => void;
  label?: string;
}> = ({ page, lastPage, total, onChange, label = 'list' }) => {
  if (lastPage <= 1) return null;
  return (
    <nav
      className="mt-4 flex items-center justify-between gap-2"
      aria-label={`Pagination for ${label}`}
    >
      <span className="text-xs text-muted-foreground">
        Page {page} of {lastPage} · {total} records
      </span>
      <div className="flex gap-2">
        <Button
          variant="outline"
          size="sm"
          disabled={page <= 1}
          onClick={() => onChange(page - 1)}
          aria-label="Previous page"
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <Button
          variant="outline"
          size="sm"
          disabled={page >= lastPage}
          onClick={() => onChange(page + 1)}
          aria-label="Next page"
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    </nav>
  );
};

/** Sticky list header for long tables/lists. */
export const StickyListHeader: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="sticky top-14 z-20 -mx-6 mb-3 border-b border-border bg-card/95 px-6 py-2 backdrop-blur">
    {children}
  </div>
);
