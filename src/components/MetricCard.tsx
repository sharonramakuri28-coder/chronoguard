import { cn } from "@/lib/utils";
import { AnimatedNumber } from "./AnimatedNumber";

export function MetricCard({
  label,
  value,
  suffix = "",
  prefix = "",
  decimals = 1,
  sub,
  tone = "default",
  icon,
  className,
}: {
  label: string;
  value: number | string;
  suffix?: string;
  prefix?: string;
  decimals?: number;
  sub?: React.ReactNode;
  tone?: "default" | "leak" | "safe" | "warn" | "hindsight";
  icon?: React.ReactNode;
  className?: string;
}) {
  const toneRing = {
    default: "",
    leak: "border-leak/25",
    safe: "border-safe/25",
    warn: "border-warn/25",
    hindsight: "border-hindsight/25",
  }[tone];

  const toneValue = {
    default: "text-foreground",
    leak: "text-leak",
    safe: "text-safe",
    warn: "text-warn",
    hindsight: "text-hindsight",
  }[tone];

  return (
    <div
      className={cn(
        "glass group relative overflow-hidden rounded-xl p-4 transition-all duration-300 hover:-translate-y-0.5 hover:border-foreground/15",
        toneRing,
        className,
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <p className="text-[11px] font-medium uppercase tracking-widest text-muted-foreground">{label}</p>
        {icon && <span className="text-muted-foreground transition-colors group-hover:text-foreground">{icon}</span>}
      </div>
      <div className={cn("mt-2 text-3xl font-semibold tracking-tight", toneValue)}>
        {typeof value === "number" ? (
          <>{prefix}<AnimatedNumber value={value} decimals={decimals} suffix={suffix} /></>
        ) : (
          value
        )}
      </div>
      {sub && <div className="mt-1 text-xs text-muted-foreground">{sub}</div>}
    </div>
  );
}
