import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Play, RotateCcw, Clock, CalendarClock, Brain } from "lucide-react";
import { listDatasetModels, runDatasetAudit, type DatasetAuditResult, type DatasetLeak } from "@/lib/chrono.functions";
import { retainHindsightLesson } from "@/lib/hindsight.functions";
import { StatusBadge } from "@/components/StatusBadge";
import { LeakageAlert } from "@/components/LeakageAlert";
import { TemporalTimeline } from "@/components/TemporalTimeline";
import { AnimatedNumber } from "@/components/AnimatedNumber";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/app/audit")({
  head: () => ({ meta: [
    { title: "Chrono Audit | ChronoGuard" },
    { name: "description", content: "Audit historical ML decisions for future-information leakage and replay with only available features." },
    { property: "og:title", content: "ChronoGuard Chrono Audit" },
    { property: "og:description", content: "Find future-information leakage in historical decisions and run a knowledge-correct replay." },
    { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" },
  ] }),
  validateSearch: (search: Record<string, unknown>) => {
    const out: { run?: boolean } = {};
    if (search["run"] === true || search["run"] === "true") out.run = true;
    return out;
  },
  component: ChronoAudit,
});

type Phase = "idle" | "scanning" | "results" | "replaying" | "replayed";
type HindsightState = { state: "idle" | "saving" | "retained" | "exists" | "fallback"; lessonId?: string };

const DATASET = "chronoguard_final_production_demo_dataset.csv";
const SCAN_STEPS = [
  "Loading decision log…",
  "Comparing available_date with decision_date…",
  "Reconstructing historical knowledge state…",
  "Cross-checking Hindsight memory…",
];

const fmtDate = (iso: string) =>
  new Date(iso + "T00:00:00Z").toLocaleDateString("en-US", { month: "long", day: "2-digit", year: "numeric", timeZone: "UTC" });
const signed = (n: number) => `${n >= 0 ? "+" : ""}${n}%`;

function ChronoAudit() {
  const { run: autoRun } = Route.useSearch();
  const queryClient = useQueryClient();
  const modelsFn = useServerFn(listDatasetModels);
  const { data: models } = useQuery({ queryKey: ["dataset-models"], queryFn: () => modelsFn() });

  const [model, setModel] = useState("MacroAlpha-v4");
  const [phase, setPhase] = useState<Phase>(autoRun ? "scanning" : "idle");
  const [result, setResult] = useState<DatasetAuditResult | null>(null);
  const [revealed, setRevealed] = useState(0);
  const [stepIdx, setStepIdx] = useState(0);
  const [hs, setHs] = useState<HindsightState>({ state: "idle" });
  const busy = phase === "replaying" || phase === "scanning";

  const auditFn = useServerFn(runDatasetAudit);
  const retainFn = useServerFn(retainHindsightLesson);

  useEffect(() => {
    if (phase !== "scanning") return;
    let cancelled = false;
    setResult(null);
    setRevealed(0);
    setStepIdx(0);
    setHs({ state: "idle" });
    (async () => {
      const res = await auditFn({ data: { model } });
      if (cancelled) return;
      setResult(res);
      for (let i = 1; i <= res.features.length; i++) {
        await new Promise((r) => setTimeout(r, 420));
        if (cancelled) return;
        setRevealed(i);
      }
      if (cancelled) return;
      setPhase("results");
      if (res.leakCount > 0) {
        setHs({ state: "saving" });
        const leaked = res.features.filter((f) => f.leaks > 0).map((f) => f.feature);
        const r = await retainFn({
          data: {
            feature: leaked.join(", "),
            lesson: `Previous experiments showed that revised economic indicators such as ${leaked.slice(0, 3).join(" and ")} can create temporal leakage because they are published after prediction time. ${res.leakCount} of ${res.decisions} decisions in ${DATASET} used a feature whose available_date was later than its decision_date.`,
          },
        });
        if (cancelled) return;
        if (!r.ok) setHs({ state: "fallback" });
        else setHs({ state: r.status === "exists" ? "exists" : "retained", lessonId: r.lessonId });
        queryClient.invalidateQueries({ queryKey: ["memories"] });
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, model]);

  useEffect(() => {
    if (phase !== "scanning") return;
    const t = setInterval(() => setStepIdx((i) => (i + 1) % SCAN_STEPS.length), 1100);
    return () => clearInterval(t);
  }, [phase]);

  const replayNow = async () => {
    setPhase("replaying");
    await new Promise((r) => setTimeout(r, 1800));
    setPhase("replayed");
  };

  return (
    <div className="mx-auto max-w-5xl space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-foreground">Chrono Audit</h1>
          <p className="mt-1 text-xs text-muted-foreground">
            Replay historical decisions using only information available at each decision time.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={model}
            onChange={(e) => {
              setModel(e.target.value);
              setPhase("idle");
              setResult(null);
            }}
            className="h-9 rounded-lg border border-border bg-card px-3 text-[13px] text-foreground focus:border-hindsight/40 focus:outline-none"
          >
            {(models ?? ["MacroAlpha-v4"]).map((m) => (
              <option key={m} value={m}>{m}</option>
            ))}
            <option value="all">All models</option>
          </select>
          <button
            onClick={() => setPhase("scanning")}
            disabled={busy}
            className="inline-flex h-9 items-center gap-2 rounded-lg bg-primary px-4 text-[13px] font-semibold text-primary-foreground transition-all hover:-translate-y-0.5 disabled:opacity-50 disabled:hover:translate-y-0"
          >
            {phase === "scanning" ? (
              <><RotateCcw className="size-3.5 animate-spin" /> Auditing…</>
            ) : (
              <><Play className="size-3.5" /> Run Chrono Audit</>
            )}
          </button>
        </div>
      </div>

      <p className="text-xs text-muted-foreground">
        Dataset <span className="font-mono">{DATASET}</span>
        {result && ` · ${result.decisions} historical decisions · ${result.features.length} features`}
      </p>

      {phase === "idle" && (
        <div className="glass grid place-items-center rounded-xl p-14 text-center">
          <ScanSearch className="size-8 text-hindsight" />
          <p className="mt-3 max-w-sm text-sm text-muted-foreground">
            ChronoGuard will compare each feature's available date with its decision date and flag anything the
            backtest could not have known at the time.
          </p>
          <button
            onClick={() => setPhase("scanning")}
            className="mt-5 inline-flex h-9 items-center gap-2 rounded-lg bg-primary px-4 text-[13px] font-semibold text-primary-foreground transition-all hover:-translate-y-0.5"
          >
            <Play className="size-3.5" /> Run Chrono Audit
          </button>
        </div>
      )}

      {phase === "scanning" && (
        <div className="glass relative overflow-hidden rounded-xl p-5">
          <div className="pointer-events-none absolute inset-x-0 top-0 h-14 animate-scanline bg-gradient-to-b from-transparent via-hindsight/15 to-transparent" />
          <div className="flex items-center gap-2.5">
            <span className="size-2 rounded-full bg-hindsight animate-blink" />
            <p className="font-mono text-xs text-hindsight">{SCAN_STEPS[stepIdx]}</p>
          </div>
          <p className="mt-1 text-[11px] text-muted-foreground">Stop your models from learning from the future.</p>
          {result && (
            <p className="mt-3 text-xs text-muted-foreground">
              Before audit — Original Backtest Return{" "}
              <span className="num font-semibold text-replay">{signed(result.originalReturn)}</span>
            </p>
          )}
          <div className="relative mt-5 min-h-56">
            <FeatureTable result={result} revealed={revealed} scanning />
          </div>
        </div>
      )}

      {(phase === "results" || phase === "replaying" || phase === "replayed") && result && (
        <div className="space-y-4">
          <div className="flex items-center justify-between rounded-xl border border-border bg-surface px-4 py-3">
            <p className="text-sm text-muted-foreground">
              Audit complete —{" "}
              <span className={cn("font-semibold", result.leakCount > 0 ? "text-leak" : "text-safe")}>
                {result.leakCount > 0
                  ? `${result.leakCount} future information leakage events detected across ${result.leakedFeatures} risky features.`
                  : "no future-information leakage detected"}
              </span>
            </p>
            <StatusBadge variant={result.leakCount > 0 ? "leak" : "safe"} pulse={result.leakCount > 0}>
              {result.leakCount > 0 ? "AT RISK" : "SAFE"}
            </StatusBadge>
          </div>
          <FeatureTable result={result} revealed={result.features.length} scanning={false} />
          {result.primary && (
            <EvidenceBlock result={result} primary={result.primary} onReplay={replayNow} busy={busy} replayed={phase === "replayed"} />
          )}
          <LeakList leaks={result.leaks} />
          <HindsightLine hs={hs} />
        </div>
      )}

      {phase === "replaying" && (
        <div className="glass relative overflow-hidden rounded-xl p-10 text-center">
          <div className="pointer-events-none absolute inset-x-0 top-0 h-14 animate-scanline bg-gradient-to-b from-transparent via-hindsight/15 to-transparent" />
          <p className="font-mono text-sm text-hindsight">Replaying historical decisions with decision-time snapshots…</p>
          <div className="mx-auto mt-5 h-1.5 w-64 overflow-hidden rounded-full bg-secondary">
            <div className="h-full w-1/3 rounded-full bg-hindsight animate-sweep" />
          </div>
          <p className="mt-4 text-xs text-muted-foreground">Recalculating performance using only information available on each decision date.</p>
        </div>
      )}

      {phase === "replayed" && result && (
        <div className="glass rounded-2xl border-hindsight/30 p-8 text-center animate-rise">
          <p className="text-[11px] font-semibold uppercase tracking-widest text-hindsight">Replay complete</p>
          <div className="mt-5 flex items-center justify-center gap-6">
            <div>
              <p className="text-[11px] uppercase tracking-widest text-muted-foreground">Original Backtest</p>
              <p className="num mt-1 text-4xl font-bold text-muted-foreground line-through decoration-leak/70 decoration-2">
                {signed(result.originalReturn)}
              </p>
            </div>
            <svg className="size-6 text-muted-foreground" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M5 12h14M13 6l6 6-6 6" />
            </svg>
            <div>
              <p className="text-[11px] uppercase tracking-widest text-hindsight">Knowledge-Correct Replay</p>
              <p className="mt-1 text-5xl font-bold text-hindsight text-glow-hindsight">
                +<AnimatedNumber value={result.correctedReturn} suffix="%" duration={1800} />
              </p>
            </div>
          </div>
          <p className="mx-auto mt-6 max-w-lg text-balance text-lg font-medium leading-snug text-foreground">
            “{result.distortion} percentage points of apparent performance disappeared after future-information leakage was removed.”
          </p>
          <p className="mt-3 text-xs text-muted-foreground">Postgres reconstructs what was knowable. Hindsight remembers what the team learned.</p>
        </div>
      )}
    </div>
  );
}

function FeatureTable({ result, revealed, scanning }: { result: DatasetAuditResult | null; revealed: number; scanning: boolean }) {
  const rows = result?.features ?? [];
  return (
    <div className="overflow-hidden rounded-lg border border-border">
      <table className="w-full text-left text-[13px]">
        <thead>
          <tr className="border-b border-border bg-surface-2/60 text-[10px] uppercase tracking-widest text-muted-foreground">
            <th className="px-4 py-2.5 font-medium">Feature</th>
            <th className="px-4 py-2.5 font-medium">Decision-Time Availability</th>
            <th className="px-4 py-2.5 text-right font-medium">Status</th>
          </tr>
        </thead>
        <tbody>
          {rows.slice(0, revealed).map((f, i) => {
            const leak = f.leaks > 0;
            return (
              <tr
                key={f.feature}
                className={cn(
                  "border-b border-border/40 last:border-0",
                  leak ? "bg-leak-soft/60" : "bg-transparent",
                  i === revealed - 1 && scanning && "animate-leak-flash",
                )}
              >
                <td className="px-4 py-2.5 font-mono text-xs text-foreground/85">{f.feature}</td>
                <td className="px-4 py-2.5 text-xs text-muted-foreground">
                  {leak
                    ? `Published after decision in ${f.leaks}/${f.total} decisions · up to ${f.maxDays} days later`
                    : `Available at decision time (${f.total} decisions)`}
                </td>
                <td className="px-4 py-2.5 text-right">
                  <StatusBadge variant={leak ? "leak" : "safe"} pulse={leak}>
                    {leak ? "FUTURE INFORMATION LEAKAGE" : "SAFE"}
                  </StatusBadge>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function EvidenceBlock({
  result,
  primary,
  onReplay,
  busy,
  replayed,
}: {
  result: DatasetAuditResult;
  primary: DatasetLeak;
  onReplay: () => void;
  busy: boolean;
  replayed: boolean;
}) {
  return (
    <LeakageAlert title="Future Knowledge Detected" className="animate-rise">
      <p className="text-sm text-foreground/90">
        {result.leakCount} future information leakage events detected. Primary incident:{" "}
        <span className="font-mono text-leak">{primary.feature}</span>
      </p>
      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { icon: CalendarClock, label: "Feature", value: primary.feature, mono: true },
          { icon: Clock, label: "Decision date", value: fmtDate(primary.decisionDate) },
          { icon: CalendarClock, label: "Available date", value: fmtDate(primary.availableDate) },
          { icon: Clock, label: "Future leakage", value: `${primary.days} days` },
        ].map((row) => (
          <div key={row.label} className="rounded-lg border border-leak/20 bg-background/40 p-3">
            <p className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-widest text-leak/80">
              <row.icon className="size-3" /> {row.label}
            </p>
            <p className={cn("mt-1.5 text-[13px] font-medium text-foreground", row.mono && "font-mono text-xs")}>{row.value}</p>
          </div>
        ))}
      </div>
      <p className="mt-4 rounded-lg border border-leak/25 bg-leak/10 px-3 py-2.5 text-sm font-medium text-leak">
        Reason: {primary.reason}.
      </p>
      <div className="mt-5 rounded-xl border border-border bg-background/40 p-5">
        <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">Temporal reconstruction</p>
        <div className="mt-4">
          <TemporalTimeline
            steps={[
              { date: fmtDate(primary.decisionDate).toUpperCase(), title: "Historical decision occurs", detail: `${primary.decisionId} · ${primary.model}`, tone: "safe" },
              { date: fmtDate(primary.availableDate).toUpperCase(), title: `${primary.feature} becomes available`, detail: `${primary.days} days after the decision`, tone: "leak" },
              { date: "CURRENT BACKTEST", title: `Used ${primary.feature} for the ${fmtDate(primary.decisionDate)} decision`, detail: "The backtest read future information while pretending it was the decision date.", tone: "leak" },
            ]}
          />
        </div>
      </div>
      <p className="mt-4 text-sm font-medium text-leak">This model replay used information that did not exist at the historical decision time.</p>
      {!replayed ? (
        <button
          onClick={onReplay}
          disabled={busy}
          className="mt-5 inline-flex h-10 items-center gap-2 rounded-lg bg-primary px-5 text-[13px] font-bold text-primary-foreground aurora-glow transition-all hover:-translate-y-0.5 disabled:opacity-60"
        >
          <RotateCcw className={cn("size-4", busy && "animate-spin")} />
          Replay Without Future Knowledge
        </button>
      ) : (
        <div className="mt-5 rounded-xl border border-hindsight/30 bg-hindsight-soft p-5 text-center aurora-glow">
          <div className="flex items-center justify-center gap-5">
            <span className="num text-2xl font-bold text-replay line-through decoration-replay/60 decoration-2">{signed(result.originalReturn)}</span>
            <span className="text-muted-foreground">→</span>
            <span className="num text-4xl font-bold text-hindsight">{signed(result.correctedReturn)}</span>
          </div>
        </div>
      )}
    </LeakageAlert>
  );
}

function LeakList({ leaks }: { leaks: DatasetLeak[] }) {
  const [all, setAll] = useState(false);
  if (!leaks.length) return null;
  const shown = all ? leaks : leaks.slice(0, 8);
  return (
    <div className="overflow-hidden rounded-lg border border-border">
      <div className="flex items-center justify-between border-b border-border bg-surface-2/60 px-4 py-2.5">
        <p className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground">Detected leakage · {leaks.length} events</p>
        {leaks.length > 8 && (
          <button onClick={() => setAll(!all)} className="text-[11px] text-hindsight hover:underline">
            {all ? "Show fewer" : `Show all ${leaks.length}`}
          </button>
        )}
      </div>
      <div className="max-h-96 overflow-auto">
        <table className="w-full text-left text-xs">
          <thead>
            <tr className="border-b border-border text-[10px] uppercase tracking-widest text-muted-foreground">
              <th className="px-4 py-2 font-medium">Feature</th>
              <th className="px-4 py-2 font-medium">Decision</th>
              <th className="px-4 py-2 font-medium">Available</th>
              <th className="px-4 py-2 text-right font-medium">Days</th>
              <th className="px-4 py-2 font-medium">Reason</th>
            </tr>
          </thead>
          <tbody>
            {shown.map((l) => (
              <tr key={l.decisionId} className="border-b border-border/40 last:border-0">
                <td className="px-4 py-2 font-mono text-foreground/85">{l.feature}</td>
                <td className="px-4 py-2 num text-muted-foreground">{l.decisionDate}</td>
                <td className="px-4 py-2 num text-replay">{l.availableDate}</td>
                <td className="px-4 py-2 num text-right text-leak">{l.days}</td>
                <td className="px-4 py-2 text-muted-foreground">{l.reason}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function HindsightLine({ hs }: { hs: HindsightState }) {
  if (hs.state === "idle") return null;
  const text = {
    saving: "Retaining this leakage pattern in Hindsight memory…",
    retained: "Real Hindsight memory retained — future uploads will recall these risky features even under different column names.",
    exists: "Lesson already exists in Hindsight memory.",
    fallback: "Demo Memory Fallback — Hindsight was unavailable, lesson not stored.",
  }[hs.state];
  return (
    <div className="flex items-start gap-2.5 rounded-xl border border-hindsight/25 bg-hindsight-soft px-4 py-3">
      <Brain className="mt-0.5 size-4 text-hindsight" />
      <div>
        <p className="text-sm text-foreground">{text}</p>
        {hs.lessonId && <p className="mt-0.5 font-mono text-[10px] text-muted-foreground">lesson_id {hs.lessonId}</p>}
      </div>
    </div>
  );
}

function ScanSearch({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <path d="M3 7V5a2 2 0 0 1 2-2h2M17 3h2a2 2 0 0 1 2 2v2M21 17v2a2 2 0 0 1-2 2h-2M7 21H5a2 2 0 0 1-2-2v-2M3 12h18" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}
