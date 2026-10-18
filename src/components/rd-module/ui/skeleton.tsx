import { cn } from "@/lib/rd-module/utils";

function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn("rd-module", "animate-pulse rounded-md bg-muted", className)} {...props} />
  );
}

export { Skeleton };
