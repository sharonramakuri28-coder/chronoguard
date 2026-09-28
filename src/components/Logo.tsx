import { cn } from "@/lib/utils";

/** Temporal-ring mark: a lavender memory ring with an apricot replay arc and a fixed "then" point. */
export function Logo({ className, mark = false }: { className?: string; mark?: boolean }) {
  return (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      <span className="relative grid size-8 place-items-center rounded-lg border border-hindsight/30 bg-surface-2">
        <svg className="size-[22px]" viewBox="0 0 24 24" fill="none" strokeLinecap="round">
          <circle cx="12" cy="12" r="8.5" stroke="var(--hindsight)" strokeOpacity="0.35" strokeWidth="1.25" />
          <path d="M12 3.5a8.5 8.5 0 0 1 8.5 8.5" stroke="var(--replay)" strokeWidth="2" />
          <path d="M5.2 17.1A8.5 8.5 0 0 1 3.5 12" stroke="var(--hindsight)" strokeWidth="2" />
          <circle cx="12" cy="12" r="4" stroke="var(--hindsight)" strokeWidth="1.25" />
          <path d="M12 12V9.2" stroke="var(--foreground)" strokeWidth="1.5" />
          <circle cx="12" cy="3.5" r="1.4" fill="var(--replay)" />
        </svg>
      </span>
      {!mark && (
        <span className="flex flex-col leading-none">
          <span className="text-[15px] font-bold tracking-tight text-foreground">ChronoGuard</span>
          <span className="mt-0.5 text-[9px] font-medium uppercase tracking-[0.18em] text-aurora">
            Epistemic Replay
          </span>
        </span>
      )}
    </span>
  );
}
