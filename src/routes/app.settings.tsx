import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { overviewQuery } from "@/lib/queries";
import { StatusBadge } from "@/components/StatusBadge";

export const Route = createFileRoute("/app/settings")({
  head: () => ({ meta: [
    { title: "Settings | ChronoGuard" },
    { name: "description", content: "View ChronoGuard workspace settings and audit statistics." },
    { property: "og:title", content: "ChronoGuard Settings" },
    { property: "og:description", content: "Workspace information and temporal audit statistics." },
    { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" },
  ] }),
  component: Settings,
});

function Settings() {
  const { data } = useQuery(overviewQuery);

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <div>
        <h1 className="text-xl font-semibold tracking-tight text-foreground">Settings</h1>
        <p className="mt-1 text-xs text-muted-foreground">Project configuration and Hindsight integration.</p>
      </div>

      <div className="glass rounded-xl p-5">
        <h2 className="text-sm font-semibold text-foreground">Project</h2>
        <div className="mt-4 space-y-3">
          <div>
            <label className="text-[11px] font-medium uppercase tracking-widest text-muted-foreground">Project name</label>
            <div className="mt-1 h-9 rounded-lg border border-border bg-card px-3 text-[13px] leading-9 text-foreground">
              Atlas Quant Research
            </div>
          </div>
          <div>
            <label className="text-[11px] font-medium uppercase tracking-widest text-muted-foreground">Descriptor</label>
            <div className="mt-1 h-9 rounded-lg border border-border bg-card px-3 text-[13px] leading-9 text-muted-foreground">
              Epistemic Replay for Machine Learning
            </div>
          </div>
        </div>
      </div>

      <div className="glass rounded-xl p-5">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-foreground">Hindsight Memory</h2>
          <StatusBadge variant="hindsight" pulse>
            Connected
          </StatusBadge>
        </div>
        <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
          Organizational memory retains every leakage lesson, pattern, and feature concept. New datasets are
          screened against it automatically.
        </p>
        <div className="mt-4 grid grid-cols-3 gap-3">
          <div className="rounded-lg border border-border bg-surface p-3 text-center">
            <p className="num text-xl font-bold text-hindsight">{data?.stats.memoryCount ?? "—"}</p>
            <p className="text-[10px] uppercase tracking-widest text-muted-foreground">Memories</p>
          </div>
          <div className="rounded-lg border border-border bg-surface p-3 text-center">
            <p className="num text-xl font-bold text-foreground">{data?.stats.leakCount ?? "—"}</p>
             <p className="text-[10px] uppercase tracking-widest text-muted-foreground">Leakage events</p>
          </div>
          <div className="rounded-lg border border-border bg-surface p-3 text-center">
             <p className="num text-xl font-bold text-warn">{data?.stats.reauditCount ?? "—"}</p>
            <p className="text-[10px] uppercase tracking-widest text-muted-foreground">High-risk features</p>
          </div>
        </div>
      </div>

      <div className="glass rounded-xl p-5">
        <h2 className="text-sm font-semibold text-foreground">Audit preferences</h2>
        <div className="mt-4 space-y-3">
          {[
            { label: "Auto-run Chrono Audit on new experiments", on: true },
            { label: "Screen uploaded datasets against memory", on: true },
            { label: "Notify on semantic (non-exact) column matches", on: true },
            { label: "Block training runs with HIGH-risk columns", on: false },
          ].map((row) => (
            <div key={row.label} className="flex items-center justify-between rounded-lg border border-border bg-surface px-4 py-2.5">
              <span className="text-[13px] text-foreground/90">{row.label}</span>
              <span
                className={`relative h-5 w-9 rounded-full transition-colors ${row.on ? "bg-hindsight/70" : "bg-secondary"}`}
              >
                <span
                  className={`absolute top-0.5 size-4 rounded-full bg-background transition-all ${row.on ? "left-[18px]" : "left-0.5"}`}
                />
              </span>
            </div>
          ))}
        </div>
        <p className="mt-4 text-[11px] text-muted-foreground">
          Demo workspace — preferences are illustrative and reset with the demo data.
        </p>
      </div>
    </div>
  );
}
