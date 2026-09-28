import { cn } from "@/lib/utils";
import type { Memory } from "@/lib/types";

const typeTone: Record<string, string> = {
  incident: "border-leak/30 bg-leak-soft text-leak",
  pattern: "border-hindsight/30 bg-hindsight-soft text-hindsight",
  rule: "border-warn/30 bg-warn-soft text-warn",
  lesson: "border-hindsight/30 bg-hindsight-soft text-hindsight",
};

export function MemoryCard({
  memory,
  className,
  pulse,
  compact,
}: {
  memory: Memory;
  className?: string;
  pulse?: boolean;
  compact?: boolean;
}) {
  const date = new Date(memory.learnedAt);
  const rel = new Intl.RelativeTimeFormat("en", { numeric: "auto" });
  const diffDays = Math.round((date.getTime() - Date.now()) / 86400000);
  const relLabel =
    Math.abs(diffDays) < 1
      ? rel.format(Math.round((date.getTime() - Date.now()) / 3600000), "hour")
      : rel.format(diffDays, "day");

  return (
    <div
      className={cn(
        "glass group rounded-xl p-4 transition-all duration-300 hover:-translate-y-0.5 hover:border-hindsight/30",
        pulse && "animate-pulse-memory border-hindsight/40",
        className,
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <span
          className={cn(
            "rounded-md border px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider",
            typeTone[memory.memoryType] ?? typeTone["incident"],
          )}
        >
          {memory.memoryType}
        </span>
        <span className="text-[11px] text-muted-foreground">{relLabel}</span>
      </div>

      <p className="mt-2.5 text-sm font-medium leading-snug text-foreground">{memory.lesson}</p>

      {!compact && (
        <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">{memory.reason}</p>
      )}

      <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-[11px] text-muted-foreground">
        <span className="font-mono text-foreground/70">{memory.feature}</span>
        <span>·</span>
        <span>{memory.experiment}</span>
        <span>·</span>
        <span>{memory.concept}</span>
      </div>

      <div className="mt-3 flex items-center gap-3">
        <div className="flex items-center gap-1.5 text-[11px] text-hindsight">
          <svg className="size-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M12 3a6 6 0 0 0-4 10.5c.6.5 1 1.4 1 2.5h6c0-1.1.4-2 1-2.5A6 6 0 0 0 12 3ZM9.5 20h5M10.5 22h3" />
          </svg>
          {memory.evidenceCount} evidence
        </div>
        <div className="h-1 w-16 overflow-hidden rounded-full bg-secondary">
          <div
            className="h-full rounded-full bg-hindsight/70"
            style={{ width: `${Math.round(memory.confidence * 100)}%` }}
          />
        </div>
        <span className="num text-[11px] text-muted-foreground">
          {Math.round(memory.confidence * 100)}%
        </span>
        {memory.tags.slice(0, 2).map((t) => (
          <span key={t} className="rounded bg-secondary px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
            {t}
          </span>
        ))}
      </div>
    </div>
  );
}
