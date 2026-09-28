import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { experimentsQuery } from "@/lib/queries";
import { StatusBadge } from "@/components/StatusBadge";
import { AnimatedNumber } from "@/components/AnimatedNumber";
import { cn } from "@/lib/utils";
import type { Experiment } from "@/lib/types";

export const Route = createFileRoute("/app/experiments")({
  head: () => ({ meta: [
    { title: "Experiments | ChronoGuard" },
    { name: "description", content: "Compare ML experiments and their historical temporal integrity." },
    { property: "og:title", content: "ChronoGuard Experiments" },
    { property: "og:description", content: "Explore experiment returns, leakage events, and audit status." },
    { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" },
  ] }),
  component: Experiments,
});

type Filter = "all" | "safe" | "warning" | "failed" | "reaudit";

const FILTERS: { key: Filter; label: string }[] = [
  { key: "all", label: "All" },
  { key: "safe", label: "Safe" },
  { key: "warning", label: "Warning" },
  { key: "failed", label: "Failed" },
  { key: "reaudit", label: "Needs Re-Audit" },
];

function statusVariant(status: Experiment["temporalStatus"]) {
  return status === "safe" ? "safe" : status === "warning" ? "warning" : "failed";
}

function statusLabel(status: Experiment["temporalStatus"]) {
  return status === "safe" ? "SAFE" : status === "warning" ? "WARNING" : "FAILED";
}

function relativeDate(d: string) {
  const days = Math.round((Date.now() - new Date(d).getTime()) / 86400000);
  if (days <= 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days} days ago`;
  if (days < 14) return "1 week ago";
  if (days < 60) return `${Math.round(days / 7)} weeks ago`;
  return `${Math.round(days / 30)} months ago`;
}

function rowStatusTone(status: string) {
  if (status === "Clean") return "clean" as const;
  if (status === "Needs Review") return "failed" as const;
  if (status === "Re-Audit") return "review" as const;
  return "neutral" as const;
}

function Experiments() {
  const { data } = useQuery(experimentsQuery);
  const [filter, setFilter] = useState<Filter>("all");

  const rows = (data ?? []).filter((e) => {
    if (filter === "all") return true;
    if (filter === "reaudit") return e.reauditFlag;
    return e.temporalStatus === filter;
  });

  return (
    <div className="mx-auto max-w-6xl space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-foreground">Experiments</h1>
          <p className="mt-1 text-xs text-muted-foreground">
            Every training run and backtest, audited against point-in-time knowledge.
          </p>
        </div>
        <div className="flex gap-1 rounded-lg border border-border bg-card p-1">
          {FILTERS.map((f) => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={cn(
                "rounded-md px-2.5 py-1 text-xs font-medium transition-colors",
                filter === f.key
                  ? "bg-secondary text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {f.label}
              {f.key === "reaudit" && data && data.some((e) => e.reauditFlag) && (
                <span className="ml-1.5 inline-block size-1.5 rounded-full bg-warn align-middle" />
              )}
            </button>
          ))}
        </div>
      </div>

      <div className="glass overflow-hidden rounded-xl">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-left text-[13px]">
            <thead>
              <tr className="border-b border-border text-[11px] uppercase tracking-widest text-muted-foreground">
                <th className="px-4 py-3 font-medium">Experiment</th>
                <th className="px-4 py-3 font-medium">Model</th>
                <th className="px-4 py-3 font-medium">Dataset</th>
                <th className="px-4 py-3 text-right font-medium">Backtest Return</th>
                <th className="px-4 py-3 font-medium">Temporal Integrity</th>
                <th className="px-4 py-3 text-right font-medium">Leakage events</th>
                <th className="px-4 py-3 font-medium">Date</th>
                <th className="px-4 py-3 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((e, i) => (
                <tr
                  key={e.slug}
                  className={cn(
                    "group cursor-pointer border-b border-border/50 transition-colors last:border-0 hover:bg-accent/60 animate-rise",
                    e.reauditFlag && "bg-warn-soft/40",
                  )}
                  style={{ animationDelay: `${i * 60}ms` }}
                >
                  <td className="px-4 py-3">
                    <Link to="/app/experiments/$id" params={{ id: e.slug }} className="block">
                      <span className="font-medium text-foreground group-hover:text-hindsight">{e.name}</span>
                      {e.reauditFlag && (
                        <span className="ml-2 rounded bg-warn-soft px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-warn">
                          New rule
                        </span>
                      )}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{e.model}</td>
                  <td className="px-4 py-3 font-mono text-xs text-foreground/70">{e.dataset}</td>
                  <td className="px-4 py-3 text-right">
                    +<AnimatedNumber value={e.accuracy} suffix="%" className="font-semibold text-foreground" />
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge variant={statusVariant(e.temporalStatus)}>{statusLabel(e.temporalStatus)}</StatusBadge>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <span className={cn("num font-semibold", e.leakageRisks > 0 ? "text-leak" : "text-muted-foreground")}>
                      {e.leakageRisks}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{relativeDate(e.ranAt)}</td>
                  <td className="px-4 py-3">
                    <StatusBadge variant={rowStatusTone(e.status)}>{e.status}</StatusBadge>
                  </td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-4 py-10 text-center text-muted-foreground">
                    No experiments match this filter.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <p className="text-xs text-muted-foreground">
        Click an experiment to inspect its temporal audit evidence.
      </p>
    </div>
  );
}
