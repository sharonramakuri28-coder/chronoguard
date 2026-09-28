import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Brain } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { reflectOnHistory } from "@/lib/hindsight.functions";
import { memoriesQuery, patternsQuery, conceptsQuery, incidentsQuery } from "@/lib/queries";
import { MemoryCard } from "@/components/MemoryCard";
import { PatternCard } from "@/components/PatternCard";
import { FeatureConceptCard } from "@/components/FeatureConceptCard";
import { StatusBadge } from "@/components/StatusBadge";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/app/memory")({
  head: () => ({ meta: [
    { title: "Memory Intelligence | ChronoGuard" },
    { name: "description", content: "Review leakage lessons, feature concepts, recurring patterns, and revision alerts." },
    { property: "og:title", content: "ChronoGuard Memory Intelligence" },
    { property: "og:description", content: "Organizational memory of temporal leakage lessons and patterns." },
    { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" },
  ] }),
  component: MemoryIntelligence,
});

const TABS = ["Memories", "Patterns", "Feature Concepts", "Timeline"] as const;
type Tab = (typeof TABS)[number];

function MemoryIntelligence() {
  const [tab, setTab] = useState<Tab>("Memories");
  useEffect(() => {
    const syncHash = () => setTab(window.location.hash === "#timeline" ? "Timeline" : "Memories");
    syncHash();
    window.addEventListener("hashchange", syncHash);
    return () => window.removeEventListener("hashchange", syncHash);
  }, []);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const reflectFn = useServerFn(reflectOnHistory);
  const [reflecting, setReflecting] = useState(false);
  const [reflection, setReflection] = useState<{ ok: boolean; text: string } | null>(null);
  const reflect = async () => {
    setReflecting(true);
    try {
      setReflection(await reflectFn());
    } catch {
      setReflection({ ok: false, text: "" });
    }
    setReflecting(false);
  };

  const { data: memories } = useQuery(memoriesQuery);
  const { data: patterns } = useQuery(patternsQuery);
  const { data: concepts } = useQuery(conceptsQuery);
  const { data: incidents } = useQuery(incidentsQuery);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (memories ?? []).filter((m) => {
      if (typeFilter !== "all" && m.memoryType !== typeFilter) return false;
      if (!q) return true;
      return (
        m.lesson.toLowerCase().includes(q) ||
        m.feature.toLowerCase().includes(q) ||
        m.concept.toLowerCase().includes(q) ||
        m.experiment.toLowerCase().includes(q)
      );
    });
  }, [memories, search, typeFilter]);

  return (
    <div className="mx-auto max-w-6xl space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-foreground">Memory Intelligence</h1>
          <p className="mt-1 text-xs text-muted-foreground">
            What ChronoGuard has learned from previous leakage incidents.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search memories…"
              className="h-9 w-56 rounded-lg border border-border bg-card pl-3 pr-3 text-[13px] text-foreground placeholder:text-muted-foreground focus:border-hindsight/40 focus:outline-none"
            />
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 text-[11px] font-semibold uppercase tracking-widest text-hindsight">
        <span>RETAIN · Store leakage incident</span><span className="text-muted-foreground">→</span>
        <span>RECALL · Retrieve similar past incidents</span><span className="text-muted-foreground">→</span>
        <span>REFLECT · Recognize recurring revision behavior</span><span className="text-muted-foreground">→</span>
        <span>IMPROVE · Warn about risky new datasets</span>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 rounded-lg border border-border bg-card p-1">
        {TABS.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={cn(
              "rounded-md px-3 py-1.5 text-[13px] font-medium transition-colors",
              tab === t ? "bg-secondary text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
            )}
          >
            {t}
          </button>
        ))}
      </div>

      {tab === "Memories" && (
        <div className="space-y-4">
          <div className="flex flex-wrap gap-1.5">
            {["all", "incident", "pattern", "rule", "lesson"].map((t) => (
              <button
                key={t}
                onClick={() => setTypeFilter(t)}
                className={cn(
                  "rounded-full border px-3 py-1 text-[11px] font-medium capitalize transition-colors",
                  typeFilter === t
                    ? "border-hindsight/40 bg-hindsight-soft text-hindsight"
                    : "border-border text-muted-foreground hover:text-foreground",
                )}
              >
                {t}
              </button>
            ))}
            <span className="ml-auto self-center text-[11px] text-muted-foreground">
              {filtered.length} of {memories?.length ?? 0} memories
            </span>
          </div>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {filtered.map((m, i) => (
              <div key={m.id} className="animate-rise" style={{ animationDelay: `${Math.min(i, 8) * 60}ms` }}>
                <MemoryCard memory={m} />
              </div>
            ))}
          </div>
          {filtered.length === 0 && (
            <div className="glass grid place-items-center rounded-xl p-12 text-center text-sm text-muted-foreground">
              <Brain className="mb-2 size-6 text-hindsight" />
              No memories match your search.
            </div>
          )}
        </div>
      )}

      {tab === "Patterns" && (
        <div className="space-y-4">
          <div className="glass rounded-xl p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-sm font-semibold text-foreground">Ask Hindsight what the team has learned</h2>
                <p className="mt-1 text-xs text-muted-foreground">
                  Postgres reconstructs what was knowable. Hindsight remembers what the team learned.
                </p>
              </div>
              <button
                onClick={reflect}
                disabled={reflecting}
                className="inline-flex h-9 items-center gap-2 rounded-lg bg-primary px-4 text-[13px] font-semibold text-primary-foreground transition-all hover:-translate-y-0.5 disabled:opacity-50"
              >
                <Brain className="size-4" />
                {reflecting ? "Reflecting…" : "Reflect on Leakage History"}
              </button>
            </div>
            {reflection && (
              <div
                className={cn(
                  "mt-4 rounded-lg border p-4 animate-rise",
                  reflection.ok ? "border-hindsight/35 bg-hindsight-soft aurora-glow" : "border-warn/30 bg-warn-soft",
                )}
              >
                <p className={cn("text-[10px] font-bold uppercase tracking-widest", reflection.ok ? "text-hindsight" : "text-warn")}>
                  {reflection.ok ? "Hindsight Reflection" : "Demo Memory Fallback"}
                </p>
                <p className="mt-2 whitespace-pre-wrap text-[13px] leading-relaxed text-foreground/90">
                  {reflection.ok
                    ? reflection.text.replace(/\*\*/g, "").replace(/^#+\s*/gm, "").replace(/^\*\s+/gm, "• ")
                    : "Hindsight is unreachable. Recorded patterns below come from the local demo memory: revised economic indicators (GDP, payrolls, CPI) replacing preliminary values in historical backtests."}
                </p>
              </div>
            )}
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            {(patterns ?? []).map((p) => (
              <PatternCard key={p.id} pattern={p} />
            ))}
          </div>
        </div>
      )}

      {tab === "Feature Concepts" && (
        <div className="grid gap-4 md:grid-cols-2">
          {(concepts ?? []).map((c) => (
            <FeatureConceptCard key={c.id} concept={c} />
          ))}
        </div>
      )}

      {tab === "Timeline" && (
        <div className="glass rounded-xl p-5">
          <p className="text-xs text-muted-foreground">Every leakage incident ChronoGuard has detected, newest first.</p>
          <div className="mt-4 space-y-2.5">
            {(incidents ?? []).map((inc, i) => (
              <div
                key={inc.id}
                className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-lg border border-border bg-surface px-4 py-3 animate-rise transition-colors hover:border-leak/25"
                style={{ animationDelay: `${Math.min(i, 8) * 60}ms` }}
              >
                <span className="num w-24 shrink-0 text-xs text-muted-foreground">
                  {new Date(inc.detectedAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "2-digit" })}
                </span>
                <span className="w-24 shrink-0 text-sm font-medium text-foreground">{inc.experiment}</span>
                <span className="font-mono text-xs text-foreground/75">{inc.feature}</span>
                <span className="min-w-0 flex-1 truncate text-xs text-muted-foreground">{inc.description}</span>
                <StatusBadge variant={inc.severity === "high" ? "leak" : "warning"}>
                  {inc.severity === "high" ? "HIGH" : "MEDIUM"}
                </StatusBadge>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
