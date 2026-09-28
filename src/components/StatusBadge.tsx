import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wider",
  {
    variants: {
      variant: {
        safe: "border-safe/30 bg-safe-soft text-safe",
        warning: "border-warn/30 bg-warn-soft text-warn",
        failed: "border-leak/40 bg-leak-soft text-leak",
        leak: "border-leak/40 bg-leak-soft text-leak",
        review: "border-warn/30 bg-warn-soft text-warn",
        clean: "border-border bg-secondary text-muted-foreground",
        hindsight: "border-hindsight/30 bg-hindsight-soft text-hindsight",
        neutral: "border-border bg-secondary text-muted-foreground",
        outline: "border-border bg-transparent text-foreground",
      },
    },
    defaultVariants: { variant: "neutral" },
  },
);

export function StatusBadge({
  variant,
  className,
  pulse,
  ...props
}: React.ComponentProps<"span"> & VariantProps<typeof badgeVariants> & { pulse?: boolean }) {
  return (
    <span className={cn(badgeVariants({ variant }), className)} {...props}>
      {pulse && (
        <span className="relative flex size-1.5">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-current opacity-60" />
          <span className="relative inline-flex size-1.5 rounded-full bg-current" />
        </span>
      )}
      {props.children}
    </span>
  );
}
