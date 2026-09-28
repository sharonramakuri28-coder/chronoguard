import { cn } from "@/lib/utils";
import { AnimatedNumber } from "./AnimatedNumber";

export function ComparisonChart({
  original,
  corrected,
  annotation,
  className,
}: {
  original: number;
  corrected: number;
  annotation?: string;
  className?: string;
}) {
  const max = Math.max(original, corrected);
  return (
    <div className={cn("space-y-5", className)}>
      <div className="space-y-2">
        <div className="flex items-baseline justify-between text-sm">
          <span className="text-muted-foreground">Original Backtest</span>
          <span className="text-xl font-semibold text-replay">
            +<AnimatedNumber value={original} suffix="%" />
          </span>
        </div>
        <div className="h-3 overflow-hidden rounded-full bg-secondary">
          <div
            className="h-full rounded-full bg-replay transition-[width] duration-1000 ease-out"
            style={{ width: `${(original / max) * 100}%` }}
          />
        </div>
      </div>

      <div className="space-y-2">
        <div className="flex items-baseline justify-between text-sm">
          <span className="text-hindsight">ChronoGuard Replay</span>
          <span className="text-xl font-semibold text-hindsight">
            +<AnimatedNumber value={corrected} suffix="%" />
          </span>
        </div>
        <div className="h-3 overflow-hidden rounded-full bg-secondary">
          <div
            className="h-full rounded-full bg-hindsight shadow-[0_0_16px_rgb(196_167_255/0.5)] transition-[width] duration-[1400ms] ease-out"
            style={{ width: `${(corrected / max) * 100}%` }}
          />
        </div>
      </div>

      <div className="flex items-start gap-2 rounded-lg border border-leak/25 bg-leak-soft px-3 py-2.5">
        <svg className="mt-0.5 size-4 shrink-0 text-leak" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M12 9v4M12 17h.01M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z" />
        </svg>
        <p className="text-xs leading-relaxed text-leak">
          <span className="num font-semibold">{(original - corrected).toFixed(1)}</span> percentage points of apparent performance disappeared after future-information leakage was removed.
        </p>
      </div>

      {annotation && (
        <p className="text-xs italic text-muted-foreground">{annotation}</p>
      )}
    </div>
  );
}
