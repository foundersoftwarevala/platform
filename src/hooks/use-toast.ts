import { toast as sonnerToast } from "sonner";

type ToastVariant = "default" | "destructive" | "success" | "info" | "warning";

export interface ToastOptions {
  title?: string;
  description?: string;
  variant?: ToastVariant;
  duration?: number;
}

/** Shadcn-style toast API mapped onto the project's sonner toaster. */
export function toast(options: ToastOptions | string) {
  if (typeof options === "string") return sonnerToast(options);
  const { title, description, variant, duration } = options;
  const message = title ?? description ?? "";
  const opts = { description: title ? description : undefined, duration };
  if (variant === "destructive") return sonnerToast.error(message, opts);
  if (variant === "success") return sonnerToast.success(message, opts);
  if (variant === "warning") return sonnerToast.warning(message, opts);
  if (variant === "info") return sonnerToast.info(message, opts);
  return sonnerToast(message, opts);
}

export function useToast() {
  return { toast, dismiss: sonnerToast.dismiss };
}
