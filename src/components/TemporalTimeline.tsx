import { cn } from "@/lib/utils";

export interface TimelineStep {
  date: string;
  title: string;
  detail: string;
  tone?: "neutral" | "leak" | "safe" | "hindsight" | "warn";
}

const dotTone = {
  neutral: "border-muted-foreground/50 bg-secondary",
  leak: "border-leak bg-leak shadow-[0_0_10px_rgb(255_107_107/0.45)]",
  safe: "border-safe bg-safe/80",
  warn: "border-warn bg-warn/80",
  hindsight: "border-hindsight bg-hindsight/80",
};

export function TemporalTimeline({
  steps,
  className,
  compact,
}: {
  steps: TimelineStep[];
  className?: string;
  compact?: boolean;
}) {
  return (
    <div className={cn("relative space-y-0", className)}>
      {steps.map((step, i) => {
        const tone = step.tone ?? "neutral";
        const last = i === steps.length - 1;
        return (
          <div
            key={i}
            className="relative flex gap-4 animate-rise pb-6 last:pb-0"
            style={{ animationDelay: `${i * 140}ms` }}
          >
            {!last && (
              <div
                className={cn(
                  "absolute left-[7px] top-5 h-[calc(100%-12px)] w-px",
                  tone === "leak" ? "bg-leak/40" : "bg-border",
                )}
              />
            )}
            <div
              className={cn(
                "relative z-10 mt-1 size-[15px] shrink-0 rounded-full border-2",
                dotTone[tone],
              )}
            />
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                <span className={cn("num text-xs font-semibold", tone === "leak" ? "text-leak" : "text-replay")}>
                  {step.date}
                </span>
                <span
                  className={cn(
                    "text-sm font-medium",
                    tone === "leak" ? "text-leak" : tone === "safe" ? "text-safe" : "text-foreground",
                  )}
                >
                  {step.title}
                </span>
              </div>
              {!compact && <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{step.detail}</p>}
            </div>
          </div>
        );
      })}
    </div>
  );
}
