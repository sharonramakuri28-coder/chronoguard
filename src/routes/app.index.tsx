import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Activity, ShieldAlert, Brain, History, Gauge } from "lucide-react";
import { overviewQuery, memoriesQuery } from "@/lib/queries";
import { MetricCard } from "@/components/MetricCard";
import { ComparisonChart } from "@/components/ComparisonChart";
import { MemoryCard } from "@/components/MemoryCard";
import { AnimatedNumber } from "@/components/AnimatedNumber";

export const Route = createFileRoute("/app/")({
  head: () => ({ meta: [
    { title: "Overview | ChronoGuard" },
    { name: "description", content: "Review MacroAlpha-v4 temporal integrity, leakage events, and knowledge-correct performance." },
    { property: "og:title", content: "ChronoGuard Overview" },
    { property: "og:description", content: "MacroAlpha-v4 audit metrics and temporal integrity at a glance." },
    { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" },
  ] }),
  component: Overview,
});

function Overview() {
  const { data } = useQuery(overviewQuery);
  const { data: memories } = useQuery(memoriesQuery);

  if (!data) return <LoadingGrid />;
  const { stats } = data;
  const featured = (memories ?? []).slice(0, 4);

  return (
    <div className="mx-auto max-w-6xl space-y-5">
      {/* Onboarding line */}
      <p className="text-xs text-muted-foreground">
        <span className="text-hindsight">Stop your models from learning from the future.</span> ChronoGuard is
        reconstructing what was knowable at each historical decision time.
      </p>

      {/* Top stats */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
        <MetricCard label="Original Backtest" value={stats.modelAccuracy} prefix="+" suffix="%" icon={<Activity className="size-4" />} />
        <MetricCard
          label="Knowledge-Correct"
          value={stats.correctedAccuracy}
          prefix="+"
          suffix="%"
          tone="hindsight"
          icon={<Gauge className="size-4" />}
        />
        <MetricCard
          label="Leakage Events Detected"
          value={stats.leakCount}
          decimals={0}
          tone="leak"
          icon={<ShieldAlert className="size-4" />}
        />
        <MetricCard
          label="Hindsight Memories"
          value={stats.memoryCount}
          decimals={0}
          tone="hindsight"
          icon={<Brain className="size-4" />}
        />
        <MetricCard
          label="High-Risk Features"
          value={stats.reauditCount}
          decimals={0}
          tone="warn"
          icon={<History className="size-4" />}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-5">
        {/* Temporal integrity hero card */}
        <div className="glass relative overflow-hidden rounded-2xl border-leak/25 p-6 lg:col-span-3">
          <div className="pointer-events-none absolute -right-16 -top-16 size-48 rounded-full bg-leak/10 blur-3xl" />
          <div className="flex items-center justify-between">
            <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
              Temporal Integrity Status
            </p>
            <span className="flex items-center gap-2 rounded-lg border border-leak/40 bg-leak-soft px-3 py-1.5">
              <span className="relative flex size-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-leak opacity-60" />
                <span className="relative inline-flex size-2 rounded-full bg-leak" />
              </span>
              <span className="text-sm font-bold tracking-widest text-leak">AT RISK</span>
            </span>
          </div>

          <p className="mt-4 text-lg font-medium leading-snug text-foreground">
            <span className="num font-bold text-leak">{stats.leakCount} future information leakage events</span> used information that was unavailable at
            decision time.
          </p>

          <div className="mt-5">
            <ComparisonChart original={stats.modelAccuracy} corrected={stats.correctedAccuracy} />
          </div>

          <div className="mt-6 flex flex-wrap gap-2.5">
            <Link
              to="/app/audit"
              search={{ run: true }}
              className="inline-flex h-9 items-center rounded-lg bg-primary px-4 text-[13px] font-semibold text-primary-foreground transition-all hover:-translate-y-0.5"
            >
              Run Chrono Audit
            </Link>
            <Link
              to="/app/audit"
              className="inline-flex h-9 items-center rounded-lg border border-border bg-secondary px-4 text-[13px] font-medium text-foreground transition-all hover:-translate-y-0.5 hover:border-foreground/20"
            >
              View Evidence
            </Link>
          </div>
        </div>

        {/* What Hindsight remembers */}
        <div className="lg:col-span-2">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="flex items-center gap-2 text-sm font-semibold text-foreground">
              <Brain className="size-4 text-hindsight" />
              What Hindsight Remembers
            </h2>
            <Link to="/app/memory" className="text-xs text-hindsight transition-opacity hover:opacity-80">
              View all →
            </Link>
          </div>
          <div className="space-y-2.5">
            {featured.map((m, i) => (
              <div key={m.id} className="animate-rise" style={{ animationDelay: `${i * 80}ms` }}>
                <MemoryCard memory={m} compact />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function LoadingGrid() {
  return (
    <div className="mx-auto max-w-6xl space-y-5">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="h-24 animate-pulse rounded-xl bg-surface-2" />
        ))}
      </div>
      <div className="h-80 animate-pulse rounded-2xl bg-surface-2" />
    </div>
  );
}
