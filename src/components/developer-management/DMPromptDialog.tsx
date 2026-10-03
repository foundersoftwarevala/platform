/**
 * DM PROMPT DIALOG
 *
 * The Developer Manager asked for reasons, notes and "which developer / which
 * task" through window.prompt: untranslatable, unlabelled for screen readers,
 * and a choice made by typing a list number. This is the one dialog that
 * replaces them. A screen asks with `await ask({...})` and gets the answer, or
 * null when the dialog was cancelled, so each action keeps its own validation
 * and its own mutation exactly where it was.
 *
 *   - a choice from a list (Select), when `choices` is given
 *   - a text answer with its minimum length shown inline, when `reasonLabel`
 *     is given
 *
 * Focus returns to the control that opened it when it closes.
 */
import React, { useCallback, useId, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useTranslation } from '@/lib/i18n/use-translation';

export type DMPromptChoice = { value: string; label: string };

export type DMPromptRequest = {
  title: string;
  description?: string;
  /** A list to choose one entry from. */
  choices?: DMPromptChoice[];
  choiceLabel?: string;
  /** Label of the text answer; leave out for a choice only. */
  reasonLabel?: string;
  /** Minimum length of the trimmed text answer. */
  minLength?: number;
  confirmLabel?: string;
};

export type DMPromptResult = { choice: string | null; reason: string | null };

export function useDMPrompt() {
  const { t } = useTranslation();
  const [request, setRequest] = useState<DMPromptRequest | null>(null);
  const [choice, setChoice] = useState('');
  const [reason, setReason] = useState('');
  const [attempted, setAttempted] = useState(false);
  const resolver = useRef<((result: DMPromptResult | null) => void) | null>(null);
  const returnFocus = useRef<HTMLElement | null>(null);
  const id = useId();

  const ask = useCallback((next: DMPromptRequest) => {
    // A second ask while one is open settles the first as cancelled.
    resolver.current?.(null);
    returnFocus.current =
      typeof document !== 'undefined' && document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    setChoice('');
    setReason('');
    setAttempted(false);
    setRequest(next);
    return new Promise<DMPromptResult | null>((resolve) => {
      resolver.current = resolve;
    });
  }, []);

  const settle = (result: DMPromptResult | null) => {
    resolver.current?.(result);
    resolver.current = null;
    setRequest(null);
  };

  const minLength = request?.minLength ?? 0;
  const hasChoices = Boolean(request?.choices);
  const hasReason = request?.reasonLabel !== undefined;
  const choiceMissing = hasChoices && !choice;
  const reasonShort = hasReason && reason.trim().length < minLength;

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    if (choiceMissing || reasonShort) {
      setAttempted(true);
      return;
    }
    settle({ choice: hasChoices ? choice : null, reason: hasReason ? reason.trim() : null });
  };

  const choiceId = `${id}-choice`;
  const choiceErrorId = `${id}-choice-error`;
  const reasonId = `${id}-reason`;
  const reasonHintId = `${id}-reason-hint`;

  const dialog = (
    <Dialog
      open={request !== null}
      onOpenChange={(open) => {
        if (!open) settle(null);
      }}
    >
      <DialogContent
        onCloseAutoFocus={(event) => {
          // Nothing here is a DialogTrigger, so focus goes back by hand.
          if (returnFocus.current && returnFocus.current.isConnected) {
            event.preventDefault();
            returnFocus.current.focus();
          }
        }}
      >
        {request && (
          <form onSubmit={submit} className="grid gap-4" noValidate>
            <DialogHeader>
              <DialogTitle>{request.title}</DialogTitle>
              {request.description ? (
                <DialogDescription>{request.description}</DialogDescription>
              ) : (
                <DialogDescription className="sr-only">{request.title}</DialogDescription>
              )}
            </DialogHeader>

            {request.choices && (
              <div className="grid gap-2">
                <Label htmlFor={choiceId}>
                  {request.choiceLabel ?? t('devmanager.prompt.choose_label')}
                </Label>
                <Select value={choice} onValueChange={setChoice}>
                  <SelectTrigger
                    id={choiceId}
                    aria-invalid={attempted && choiceMissing ? true : undefined}
                    aria-describedby={attempted && choiceMissing ? choiceErrorId : undefined}
                  >
                    <SelectValue placeholder={t('devmanager.prompt.choose_placeholder')} />
                  </SelectTrigger>
                  <SelectContent>
                    {request.choices.map((c) => (
                      <SelectItem key={c.value} value={c.value}>
                        {c.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {attempted && choiceMissing && (
                  <p id={choiceErrorId} role="alert" className="text-xs text-destructive">
                    {t('devmanager.prompt.choice_required')}
                  </p>
                )}
              </div>
            )}

            {hasReason && (
              <div className="grid gap-2">
                <Label htmlFor={reasonId}>{request.reasonLabel}</Label>
                <Textarea
                  id={reasonId}
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  aria-invalid={attempted && reasonShort ? true : undefined}
                  aria-describedby={minLength > 0 ? reasonHintId : undefined}
                  autoFocus={!request.choices}
                  rows={3}
                />
                {minLength > 0 && (
                  <p
                    id={reasonHintId}
                    aria-live="polite"
                    className={`text-xs ${attempted && reasonShort ? 'text-destructive' : 'text-muted-foreground'}`}
                  >
                    {t('devmanager.prompt.min_length', {
                      min: minLength,
                      count: reason.trim().length,
                    })}
                  </p>
                )}
              </div>
            )}

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => settle(null)}>
                {t('devmanager.prompt.cancel')}
              </Button>
              <Button type="submit">
                {request.confirmLabel ?? t('devmanager.prompt.confirm')}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );

  return { ask, dialog };
}
