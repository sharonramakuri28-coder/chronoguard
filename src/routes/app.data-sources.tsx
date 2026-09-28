import { createFileRoute } from "@tanstack/react-router";
import { useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Upload, FileSpreadsheet, Brain, Ban, ShieldCheck, Map } from "lucide-react";
import { datasetScansQuery } from "@/lib/queries";
import { analyzeDataset, recordScanDecision } from "@/lib/chrono.functions";
import { recallForDataset } from "@/lib/hindsight.functions";
import { DEMO_COLUMNS, type DatasetFinding, type DatasetScan } from "@/lib/types";
import { StatusBadge } from "@/components/StatusBadge";
import { TemporalTimeline } from "@/components/TemporalTimeline";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/app/data-sources")({
  head: () => ({ meta: [
    { title: "Data Sources | ChronoGuard" },
    { name: "description", content: "Screen datasets for risky revision-sensitive indicators before historical analysis." },
    { property: "og:title", content: "ChronoGuard Data Sources" },
    { property: "og:description", content: "Check new datasets against temporal leakage lessons." },
    { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" },
  ] }),
  component: DataSources,
});

function parseCsvColumns(text: string): string[] {
  const firstLine = text.split(/\r?\n/)[0]?.trim() ?? "";
  if (!firstLine) return [];
  return firstLine.split(",").map((c) => c.trim().replace(/^"|"$/g, "")).filter(Boolean);
}

const riskVariant = {
  high: "leak",
  medium: "warning",
  low: "neutral",
  safe: "safe",
} as const;

const riskLabel = {
  high: "HIGH RISK",
  medium: "REVIEW",
  low: "UNKNOWN",
  safe: "SAFE",
} as const;

function DataSources() {
  const queryClient = useQueryClient();
  const { data: scans } = useQuery(datasetScansQuery);
  const fileRef = useRef<HTMLInputElement>(null);

  const [phase, setPhase] = useState<"idle" | "scanning" | "found">("idle");
  const [scan, setScan] = useState<DatasetScan | null>(null);
  const [columns, setColumns] = useState<string[]>([]);
  const [gdpView, setGdpView] = useState<"march1" | "today">("march1");
  const [decision, setDecision] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const analyzeFn = useServerFn(analyzeDataset);
  const decideFn = useServerFn(recordScanDecision);
  const recallFn = useServerFn(recallForDataset);
  const [recall, setRecall] = useState<{ ok: boolean; results: { id: string; text: string; type: string | null }[] } | null>(null);

  const runScan = async (filename: string, cols: string[]) => {
    setPhase("scanning");
    setColumns(cols);
    setDecision(null);
    setRecall(null);
    const [res, rec] = await Promise.all([
      analyzeFn({ data: { filename, columns: cols } }),
      recallFn({ data: { filename, columns: cols } }).catch(() => ({ ok: false as const, results: [] })),
      new Promise((r) => setTimeout(r, 1400)), // schema scan animation
    ]);
    setRecall(rec);
    setScan(res);
    queryClient.invalidateQueries({ queryKey: ["dataset-scans"] });
    setPhase("found");
  };

  const onFile = async (file: File) => {
    const text = await file.text();
    const cols = parseCsvColumns(text);
    if (cols.length) await runScan(file.name, cols);
  };

  const decide = async (d: string) => {
    setDecision(d);
    if (scan) await decideFn({ data: { scanId: scan.id, decision: d } });
    queryClient.invalidateQueries({ queryKey: ["dataset-scans"] });
  };

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight text-foreground">Data Sources</h1>
        <p className="mt-1 text-xs text-muted-foreground">
          Temporal reconstruction of every source — what was known, and when.
        </p>
      </div>

      {/* GDP knowledge state */}
      <div className="glass rounded-xl p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold text-foreground">Knowledge-state · GDP Growth</h2>
            <p className="mt-1 text-xs text-muted-foreground">The same metric, as it existed at two moments in time.</p>
          </div>
          <div className="flex gap-1 rounded-lg border border-border bg-card p-1">
            {(
              [
                { key: "march1", label: "Known Then · March 01" },
                { key: "today", label: "Known Now" },
              ] as const
            ).map((opt) => (
              <button
                key={opt.key}
                onClick={() => setGdpView(opt.key)}
                className={cn(
                  "rounded-md px-3 py-1 text-xs font-medium transition-colors",
                  gdpView === opt.key ? "bg-secondary text-foreground" : "text-muted-foreground hover:text-foreground",
                )}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-5 grid gap-4 md:grid-cols-2">
          <div className="rounded-xl border border-border bg-surface p-4">
            {gdpView === "march1" ? (
              <>
                <p className="text-[11px] uppercase tracking-widest text-muted-foreground">Visible to the model</p>
                <p className="num mt-2 text-4xl font-bold text-safe">2.1%</p>
                <p className="mt-1 text-xs text-muted-foreground">Preliminary release · March 01, 2025</p>
              </>
            ) : (
              <>
                <p className="text-[11px] uppercase tracking-widest text-muted-foreground">Later revision (retrospective)</p>
                <p className="num mt-2 text-4xl font-bold text-warn">1.2%</p>
                <p className="mt-1 text-xs text-muted-foreground">Revision published · March 20, 2025</p>
              </>
            )}
          </div>
          <TemporalTimeline
            compact
            steps={[
              { date: "March 01", title: "GDP preliminary value published · 2.1%", detail: "The value available to the historical decision-maker.", tone: gdpView === "march1" ? "safe" : "neutral" },
              { date: "March 01", title: "Historical trading decision occurs", detail: "Only the 2.1% release was knowable.", tone: "safe" },
              { date: "March 20", title: "GDP revised · 1.2%", detail: "Published 19 days later; unavailable on March 01.", tone: gdpView === "today" ? "leak" : "neutral" },
            ]}
          />
        </div>
      </div>

      {/* Historical knowledge-state example */}
      <div className="glass rounded-xl p-5">
        <h2 className="text-sm font-semibold text-foreground">Knowledge-state · Historical backtest</h2>
        <p className="mt-1 text-xs text-muted-foreground">The backtest must use the release known at each decision time.</p>
        <div className="mt-4 max-w-xl">
          <TemporalTimeline
            steps={[
              { date: "March 01", title: "Historical trading decision · GDP Growth 2.1%", detail: "Known Then: preliminary public release.", tone: "safe" },
              { date: "March 20", title: "GDP Growth revised to 1.2%", detail: "Known Now: this revision was unavailable 19 days earlier.", tone: "leak" },
            ]}
          />
        </div>
      </div>

      {/* Dataset upload */}
      <div className="glass rounded-xl p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="flex items-center gap-2 text-sm font-semibold text-foreground">
              <Upload className="size-4 text-hindsight" />
              New dataset screening
            </h2>
            <p className="mt-1 text-xs text-muted-foreground">
              Upload a CSV — every column is checked against Hindsight memory before it reaches a historical backtest.
            </p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => runScan("macro_revisions.csv", DEMO_COLUMNS)}
              disabled={phase === "scanning"}
              className="inline-flex h-9 items-center gap-2 rounded-lg border border-hindsight/40 bg-hindsight-soft px-3.5 text-[13px] font-semibold text-hindsight transition-all hover:-translate-y-0.5 disabled:opacity-50"
            >
              <FileSpreadsheet className="size-4" />
              Use demo file
            </button>
            <button
              onClick={() => fileRef.current?.click()}
              disabled={phase === "scanning"}
              className="inline-flex h-9 items-center gap-2 rounded-lg bg-primary px-4 text-[13px] font-semibold text-primary-foreground transition-all hover:-translate-y-0.5 disabled:opacity-50"
            >
              <Upload className="size-4" />
              Upload CSV
            </button>
            <input
              ref={fileRef}
              type="file"
              accept=".csv,text/csv"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) onFile(f);
                e.target.value = "";
              }}
            />
          </div>
        </div>

        {/* Scanning */}
        {phase === "scanning" && (
          <div className="mt-5 overflow-hidden rounded-lg border border-border bg-surface p-4">
            <div className="pointer-events-none relative h-0">
              <div className="absolute inset-x-0 top-0 h-10 animate-scanline bg-gradient-to-b from-transparent via-hindsight/15 to-transparent" />
            </div>
            <p className="font-mono text-xs text-hindsight">Parsing schema · detecting column types · recalling memory…</p>
            <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-5">
              {(columns.length ? columns : DEMO_COLUMNS).map((c, i) => (
                <div
                  key={c}
                  className="rounded border border-border bg-background/60 px-2 py-1.5 font-mono text-[11px] text-foreground/70 animate-rise"
                  style={{ animationDelay: `${i * 140}ms` }}
                >
                  {c}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Schema scan result */}
        {phase === "found" && scan && (
          <div className="mt-5 space-y-4">
            <div className="overflow-hidden rounded-lg border border-border">
              <table className="w-full text-left text-[13px]">
                <thead>
                  <tr className="border-b border-border bg-surface-2/60 text-[10px] uppercase tracking-widest text-muted-foreground">
                    <th className="px-4 py-2.5 font-medium">Detected column</th>
                    <th className="px-4 py-2.5 font-medium">Hindsight match</th>
                    <th className="px-4 py-2.5 text-right font-medium">Risk</th>
                  </tr>
                </thead>
                <tbody>
                  {scan.findings.map((f: DatasetFinding, i) => (
                    <tr key={f.column} className={cn("border-b border-border/40 last:border-0 animate-rise", f.risk === "high" && "bg-leak-soft/50")} style={{ animationDelay: `${i * 90}ms` }}>
                      <td className="px-4 py-2.5 font-mono text-xs text-foreground/85">{f.column}</td>
                      <td className="px-4 py-2.5 text-xs text-muted-foreground">
                        {f.concept ? (
                          <>
                            {f.matchType === "exact" ? "Exact alias · " : `Semantic · ${Math.round(f.similarity * 100)}% · `}
                            <span className="text-foreground/80">{f.concept}</span>
                          </>
                        ) : (
                          "No memory match"
                        )}
                      </td>
                      <td className="px-4 py-2.5 text-right">
                        <StatusBadge variant={riskVariant[f.risk]} pulse={f.risk === "high"}>
                          {riskLabel[f.risk]}
                        </StatusBadge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Hindsight memory activation */}
            {scan.findings.some((f) => f.risk === "high") && (
              <div className="rounded-xl border border-hindsight/40 bg-hindsight-soft p-5 animate-pulse-memory animate-rise aurora-glow">
                <div className="flex flex-wrap items-center gap-2">
                  <Brain className="size-4 text-hindsight" />
                  <h3 className="text-sm font-bold uppercase tracking-widest text-hindsight">Related Memory Found</h3>
                  {recall?.ok && recall.results.length > 0 ? (
                    <StatusBadge variant="hindsight">Recalled from Hindsight</StatusBadge>
                  ) : (
                    <StatusBadge variant="warning">Demo Memory Fallback</StatusBadge>
                  )}
                </div>
                <p className="mt-1.5 text-[11px] text-muted-foreground">
                  Postgres reconstructs what was knowable. Hindsight remembers what the team learned.
                </p>

                {/* Deterministic evidence */}
                <div className="mt-3 rounded-lg border border-replay/25 bg-background/50 p-4">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-replay">Deterministic Evidence</p>
                  {scan.findings
                    .filter((f) => f.risk === "high")
                    .map((f) => (
                      <div key={f.column} className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px]">
                        <span className="font-mono text-leak">{f.column}</span>
                        <span className="text-muted-foreground">→ {f.concept}</span>
                        {f.temporalRule && <span className="text-[12px] text-foreground/80">· {f.temporalRule}</span>}
                        <StatusBadge variant="leak">Risk: HIGH</StatusBadge>
                      </div>
                    ))}
                </div>

                {/* Hindsight memory evidence */}
                <div className="mt-3 rounded-lg border border-hindsight/25 bg-background/50 p-4">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-hindsight">
                    Hindsight Memory Evidence
                    {!(recall?.ok && recall.results.length > 0) && <span className="ml-2 text-warn">· Demo Memory Fallback</span>}
                  </p>
                  {recall?.ok && recall.results.length > 0 ? (
                    <ul className="mt-2 space-y-2">
                      {recall.results.map((r) => (
                        <li key={r.id} className="rounded border border-hindsight/20 bg-hindsight-soft/60 px-3 py-2 text-[13px] leading-relaxed text-foreground/90">
                          “{r.text}”
                          {r.type && <span className="ml-2 font-mono text-[10px] text-hindsight/80">{r.type}</span>}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    scan.findings
                      .filter((f) => f.risk === "high" && f.lesson)
                      .map((f) => (
                        <p key={f.column} className="mt-2 rounded border border-hindsight/20 bg-hindsight-soft/60 px-3 py-2 text-[13px] leading-relaxed text-foreground/90">
                          Local string-match lesson ({f.concept}): “{f.lesson}”
                        </p>
                      ))
                  )}
                </div>

                {!decision ? (
                  <div className="mt-4 flex flex-wrap gap-2">
                    {[
                      { label: "Review Mapping", icon: Map },
                      { label: "Mark as Safe", icon: ShieldCheck },
                      { label: "Exclude from Backtest", icon: Ban },
                    ].map((b) => (
                      <button
                        key={b.label}
                        onClick={() => decide(b.label)}
                        disabled={pending}
                        className={cn(
                          "inline-flex h-8.5 items-center gap-1.5 rounded-lg px-3 text-xs font-semibold transition-all hover:-translate-y-0.5",
                          b.label === "Exclude from Backtest"
                            ? "bg-leak text-leak-foreground"
                            : "border border-border bg-card text-foreground",
                        )}
                      >
                        <b.icon className="size-3.5" />
                        {b.label}
                      </button>
                    ))}
                    <button
                      onClick={() => decide("Ignored")}
                      className="inline-flex h-8.5 items-center rounded-lg px-3 text-xs font-medium text-muted-foreground hover:text-foreground"
                    >
                      Ignore
                    </button>
                  </div>
                ) : (
                  <p className="mt-4 rounded-lg border border-border bg-surface px-3 py-2.5 text-[13px] text-foreground">
                    Decision recorded: <span className="font-semibold text-hindsight">{decision}</span>
                    {decision === "Exclude from Backtest" && " — column removed from the backtest manifest."}
                  </p>
                )}

                <p className="mt-4 text-[11px] italic text-hindsight/90">
                  This warning came from organizational memory, not a hard-coded column rule.
                </p>
              </div>
            )}
          </div>
        )}

        {/* Past scans */}
        {(scans?.length ?? 0) > 0 && phase !== "found" && (
          <div className="mt-5 space-y-2">
            <p className="text-[11px] font-medium uppercase tracking-widest text-muted-foreground">Recent scans</p>
            {scans!.slice(0, 5).map((s) => (
              <div key={s.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 rounded-lg border border-border bg-surface px-4 py-2.5 text-xs">
                <span className="font-mono text-foreground/80">{s.filename}</span>
                <span className="text-muted-foreground">{s.columns.length} columns</span>
                <span className={cn("font-semibold", s.findings.some((f) => f.risk === "high") ? "text-leak" : "text-safe")}>
                  {s.findings.filter((f) => f.risk === "high").length} high-risk
                </span>
                {s.decision && <span className="text-hindsight">· {s.decision}</span>}
                <span className="ml-auto text-muted-foreground">
                  {new Date(s.createdAt).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
