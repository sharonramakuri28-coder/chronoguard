import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, ScanSearch } from "lucide-react";
import { experimentQuery, auditRunQuery, conceptsQuery } from "@/lib/queries";
import { StatusBadge } from "@/components/StatusBadge";
import { AnimatedNumber } from "@/components/AnimatedNumber";
import { TemporalTimeline } from "@/components/TemporalTimeline";

export const Route = createFileRoute("/app/experiments/$id")({
  head: ({ params }) => ({ meta: [
    { title: `${params.id} | ChronoGuard Experiments` },
    { name: "description", content: `Inspect ${params.id} features, audit findings, and historical decision availability.` },
    { property: "og:title", content: `${params.id} | ChronoGuard` },
    { property: "og:description", content: `Temporal integrity details for the ${params.id} experiment.` },
    { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" },
  ] }),
  component: ExperimentDetail,
});

function ExperimentDetail() {
  const { id } = useParams({ from: "/app/experiments/$id" });
  const { data: exp } = useQuery(experimentQuery(id));
  const { data: run } = useQuery(auditRunQuery(id));
  const { data: concepts } = useQuery(conceptsQuery);

  if (!exp) {
    return <div className="mx-auto max-w-6xl py-20 text-center text-muted-foreground">Experiment not found.</div>;
  }

  const findingFor = (feature: string) => {
    const fromRun = run?.findings.find((f) => f.feature === feature);
    if (fromRun) return fromRun;
    const concept = concepts?.find((c) => c.aliases.includes(feature));
    if (concept?.postOutcome) return { feature, availability: "Available only after the outcome occurs", status: "leakage" as const };
    return { feature, availability: "Available at decision time", status: "safe" as const };
  };

  return (
    <div className="mx-auto max-w-5xl space-y-5">
      <Link
        to="/app/experiments"
        className="inline-flex items-center gap-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="size-3.5" /> All experiments
      </Link>

      {/* Header */}
      <div className="glass flex flex-wrap items-center justify-between gap-4 rounded-xl p-5">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-semibold tracking-tight text-foreground">{exp.name}</h1>
            <StatusBadge variant={exp.temporalStatus === "safe" ? "safe" : exp.temporalStatus === "warning" ? "warning" : "failed"}>
              {exp.temporalStatus === "safe" ? "SAFE" : exp.temporalStatus === "warning" ? "WARNING" : "FAILED"}
            </StatusBadge>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            {exp.model} · <span className="font-mono">{exp.dataset}</span> · {exp.status}
          </p>
        </div>
        <Link
          to="/app/audit"
          search={{ run: true }}
          className="inline-flex h-9 items-center gap-2 rounded-lg bg-primary px-4 text-[13px] font-semibold text-primary-foreground transition-all hover:-translate-y-0.5"
        >
          <ScanSearch className="size-4" />
          Run Chrono Audit
        </Link>
      </div>

      {/* Metrics */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <div className="glass rounded-xl p-4">
          <p className="text-[11px] font-medium uppercase tracking-widest text-muted-foreground">Original backtest return</p>
          <p className="mt-1.5 text-2xl font-semibold text-foreground">
            +<AnimatedNumber value={exp.accuracy} suffix="%" />
          </p>
        </div>
        <div className="glass rounded-xl p-4">
          <p className="text-[11px] font-medium uppercase tracking-widest text-muted-foreground">Leakage events detected</p>
          <p className={`mt-1.5 text-2xl font-semibold ${exp.leakageRisks > 0 ? "text-leak" : "text-safe"}`}>
            <AnimatedNumber value={exp.leakageRisks} decimals={0} />
          </p>
        </div>
        <div className="glass rounded-xl p-4">
          <p className="text-[11px] font-medium uppercase tracking-widest text-muted-foreground">Features used</p>
          <p className="mt-1.5 text-2xl font-semibold text-foreground num">{exp.featuresUsed.length}</p>
        </div>
        <div className="glass rounded-xl p-4">
          <p className="text-[11px] font-medium uppercase tracking-widest text-muted-foreground">Last audit</p>
          <p className="mt-1.5 text-2xl font-semibold text-foreground">
            {run ? new Date(run.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric" }) : "—"}
          </p>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Feature audit */}
        <div className="glass rounded-xl p-5">
          <h2 className="text-sm font-semibold text-foreground">Feature temporal audit</h2>
          <p className="mt-1 text-xs text-muted-foreground">Availability of each indicator at decision time.</p>
          <div className="mt-4 space-y-2">
            {exp.featuresUsed.map((f) => {
              const finding = findingFor(f);
              return (
                <div
                  key={f}
                  className={`flex items-center justify-between gap-3 rounded-lg border px-3 py-2.5 animate-leak-flash ${
                    finding.status === "leakage" ? "border-leak/30 bg-leak-soft" : "border-border bg-surface"
                  }`}
                >
                  <div className="min-w-0">
                    <p className="truncate font-mono text-xs text-foreground/85">{f}</p>
                    <p className="mt-0.5 text-[11px] text-muted-foreground">{finding.availability}</p>
                  </div>
                  <StatusBadge variant={finding.status === "leakage" ? "leak" : finding.status === "warning" ? "warning" : "safe"}>
                    {finding.status === "leakage" ? "LEAKAGE" : finding.status === "warning" ? "REVIEW" : "SAFE"}
                  </StatusBadge>
                </div>
              );
            })}
          </div>
        </div>

        {/* Timeline for the first leaked feature */}
        <div className="glass rounded-xl p-5">
          <h2 className="text-sm font-semibold text-foreground">Evidence timeline</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            How future information entered this experiment.
          </p>
          <div className="mt-4">
            <TemporalTimeline
              steps={[
                 { date: "March 01", title: "GDP preliminary value published", detail: "2.1% was publicly available on decision day.", tone: "safe" },
                 { date: "March 01", title: "Historical trading decision occurs", detail: "The strategy could only use the preliminary release.", tone: "safe" },
                 { date: "March 20", title: "GDP revised to 1.2%", detail: "This revision appeared 19 days after the decision.", tone: "leak" },
                 { date: "Current backtest", title: "Later revision used", detail: "The backtest read March 20 information while pretending it was March 01.", tone: "warn" },
                {
                  date: "ChronoGuard",
                  title: "Replay with point-in-time data",
                  detail: "Re-running with only knowable features gives the honest number.",
                  tone: "hindsight",
                },
              ]}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
