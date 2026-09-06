import { toast } from "sonner";

/**
 * What a control says when there is no module behind it yet.
 *
 * A large number of buttons across the manager consoles carried no handler at
 * all: pressing them produced nothing — no navigation, no message, no error.
 * That is the worst failure mode, because the operator cannot tell whether the
 * feature is missing, whether they clicked the wrong thing, or whether the app
 * is broken. They press it again, and again.
 *
 * These controls now say plainly that the module has not been built. That is
 * not a fix for the missing feature, and it is not meant to look like one — it
 * is the difference between a screen that lies by silence and one an operator
 * can trust and work around.
 *
 * When a control is given a real implementation, remove the call rather than
 * leaving it beside working code.
 */
export function notBuilt(label: string, detail?: string): void {
  toast.info(`${label} is not connected yet`, {
    description: detail ?? "There is no module behind this control. It is on the build list.",
  });
}

/**
 * For a control that is part of a design preview rather than a live record —
 * the sample product card in Card Manager, for instance. Pressing it should
 * not appear to act on anything real.
 */
export function previewOnly(label: string): void {
  toast.info(`${label} — preview only`, {
    description: "This card is a design preview, not a live listing.",
  });
}
