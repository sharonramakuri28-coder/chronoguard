import { createFileRoute, Link } from "@tanstack/react-router";
import { Logo } from "@/components/Logo";
import { AnimatedNumber } from "@/components/AnimatedNumber";
import { useQuery } from "@tanstack/react-query";
import { overviewQuery } from "@/lib/queries";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "ChronoGuard — Your model should only know what the real world knew." },
      {
        name: "description",
        content:
          "ChronoGuard detects future-information leakage in ML models and backtests, replays experiments with only knowable data, and remembers every incident with Hindsight Memory Intelligence.",
      },
      { property: "og:title", content: "ChronoGuard — Epistemic Replay for Machine Learning" },
      {
        property: "og:description",
        content: "Stop your models from learning from the future.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Landing,
});

function Landing() {
  const { data } = useQuery(overviewQuery);
  const stats = data?.stats;
  return (
    <div className="grid-bg min-h-screen bg-background">
      {/* Nav */}
      <header className="sticky top-0 z-40 border-b border-border/60 bg-background/80 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
          <Logo />
          <nav className="hidden items-center gap-7 text-sm text-muted-foreground md:flex">
            <a href="#how" className="transition-colors hover:text-foreground">How it works</a>
            <a href="#memory" className="transition-colors hover:text-foreground">Hindsight Memory</a>
            <Link to="/app/experiments" className="transition-colors hover:text-foreground">Experiments</Link>
          </nav>
          <Link
            to="/app"
            className="rounded-lg border border-border bg-secondary px-4 py-2 text-sm font-medium text-foreground transition-all hover:border-foreground/20 hover:bg-accent"
          >
            Open Dashboard
          </Link>
        </div>
      </header>

      {/* Hero */}
      <section className="relative mx-auto max-w-6xl px-6 pb-16 pt-20 md:pt-28">
        <div className="pointer-events-none absolute left-1/2 top-0 h-[420px] w-[720px] -translate-x-1/2 rounded-full bg-hindsight/10 blur-[120px]" />
        <div className="relative mx-auto max-w-3xl text-center">
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-hindsight/25 bg-hindsight-soft px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-hindsight">
            <span className="size-1.5 rounded-full bg-hindsight animate-blink" />
            Epistemic Replay for Machine Learning
          </div>
          <h1 className="text-balance text-4xl font-bold leading-[1.08] tracking-tight text-foreground md:text-6xl">
            Your model should only know what{" "}
            <span className="text-hindsight text-glow-hindsight">the real world knew.</span>
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-pretty text-base leading-relaxed text-muted-foreground md:text-lg">
            ChronoGuard detects future-information leakage, reconstructs what was actually knowable at each historical decision point, and uses Hindsight memory to prevent the same temporal mistakes from repeating.
          </p>
          <div className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link
              to="/app/audit"
              className="group inline-flex h-11 items-center gap-2 rounded-lg bg-primary px-6 text-sm font-semibold text-primary-foreground shadow-[0_8px_30px_-8px_rgb(167_139_250/0.45)] transition-all hover:-translate-y-0.5 hover:shadow-[0_12px_36px_-8px_rgb(246_177_122/0.4)]"
            >
              Run Chrono Audit
              <svg className="size-4 transition-transform group-hover:translate-x-0.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M5 12h14M13 6l6 6-6 6" />
              </svg>
            </Link>
            <Link
              to="/app"
              className="inline-flex h-11 items-center rounded-lg border border-border bg-card px-6 text-sm font-medium text-foreground transition-all hover:-translate-y-0.5 hover:border-foreground/20"
            >
              View Demo
            </Link>
          </div>
          <p className="mt-5 inline-flex items-center gap-1.5 text-xs text-muted-foreground">
            <span className="size-1.5 rounded-full bg-safe" />
            Powered by Hindsight Memory
          </p>
        </div>

        {/* Dashboard mock */}
        <div className="relative mx-auto mt-16 max-w-4xl animate-rise" style={{ animationDelay: "200ms" }}>
          <div className="glass overflow-hidden rounded-2xl">
            <div className="flex items-center gap-1.5 border-b border-border/70 px-4 py-3">
              <span className="size-2.5 rounded-full bg-leak/60" />
              <span className="size-2.5 rounded-full bg-warn/60" />
              <span className="size-2.5 rounded-full bg-safe/60" />
              <span className="ml-3 font-mono text-[11px] text-muted-foreground">chronoguard / atlas-quant-research</span>
            </div>
            <div className="grid gap-4 p-5 md:grid-cols-5">
              <div className="space-y-4 md:col-span-3">
                <div className="flex items-center justify-between rounded-xl border border-leak/30 bg-leak-soft px-4 py-3">
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-widest text-leak">Temporal integrity</p>
                    <p className="mt-0.5 text-lg font-bold text-leak">AT RISK</p>
                  </div>
                  <span className="num rounded-lg bg-leak/15 px-3 py-1.5 text-2xl font-bold text-leak">{stats ? `${stats.leakCount} leakage events detected` : "— leakage events detected"}</span>
                </div>
                {[
                  { f: "GDP_final_revision", s: "FUTURE LEAKAGE", safe: false },
                  { f: "payroll_revised_value", s: "FUTURE LEAKAGE", safe: false },
                  { f: "CPI_final_revision", s: "FUTURE LEAKAGE", safe: false },
                  { f: "economic_report_summary", s: "FUTURE LEAKAGE", safe: false },
                ].map((r) => (
                  <div key={r.f} className="flex items-center justify-between rounded-lg border border-border bg-surface px-4 py-2.5">
                    <span className="font-mono text-xs text-foreground/80">{r.f}</span>
                    <span className={`text-[10px] font-bold tracking-widest ${r.safe ? "text-safe" : "text-leak"}`}>{r.s}</span>
                  </div>
                ))}
              </div>
              <div className="rounded-xl border border-border bg-surface p-4 md:col-span-2">
                <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Replay</p>
                <div className="mt-3 flex items-baseline gap-2">
                   <span className="num text-3xl font-bold text-replay">+<AnimatedNumber value={stats?.modelAccuracy ?? 0} suffix="%" /></span>
                  <span className="text-muted-foreground">→</span>
                   <span className="num text-3xl font-bold text-hindsight">+<AnimatedNumber value={stats?.correctedAccuracy ?? 0} suffix="%" /></span>
                </div>
                <div className="mt-4 space-y-2.5">
                  <div className="h-2 overflow-hidden rounded-full bg-secondary">
                    <div className="h-full w-[85%] rounded-full bg-foreground/60" />
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-secondary">
                    <div className="h-full w-[16%] rounded-full bg-hindsight shadow-[0_0_12px_rgb(196_167_255/0.5)]" />
                  </div>
                </div>
                <p className="mt-4 text-[11px] leading-relaxed text-muted-foreground">
                   "{stats ? (stats.modelAccuracy - stats.correctedAccuracy).toFixed(1) : "—"} percentage points of apparent performance disappeared after future-information leakage was removed."
                </p>
              </div>
            </div>
          </div>
          <div className="pointer-events-none absolute -inset-x-8 -bottom-10 h-24 bg-gradient-to-t from-background to-transparent" />
        </div>
      </section>

      {/* Two layers */}
      <section id="how" className="mx-auto max-w-6xl px-6 py-20">
        <div className="grid gap-5 md:grid-cols-2">
          <div className="panel group p-7 transition-all duration-300 hover:-translate-y-1 hover:border-leak/25">
            <div className="grid size-10 place-items-center rounded-lg border border-leak/30 bg-leak-soft">
              <svg className="size-5 text-leak" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 3" />
              </svg>
            </div>
            <h2 className="mt-5 text-lg font-semibold text-foreground">Deterministic Temporal Audit</h2>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              Checks what information was actually available at the moment of each prediction or decision — then
              replays the model with nothing else.
            </p>
          </div>
          <div id="memory" className="panel group p-7 transition-all duration-300 hover:-translate-y-1 hover:border-hindsight/25">
            <div className="grid size-10 place-items-center rounded-lg border border-hindsight/30 bg-hindsight-soft">
              <svg className="size-5 text-hindsight" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 3a6 6 0 0 0-4 10.5c.6.5 1 1.4 1 2.5h6c0-1.1.4-2 1-2.5A6 6 0 0 0 12 3ZM9.5 20h5M10.5 22h3" />
              </svg>
            </div>
            <h2 className="mt-5 text-lg font-semibold text-foreground">Hindsight Memory Intelligence</h2>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              Remembers previous leakage incidents, why they happened, and which data sources are risky — then warns
              your team the moment a similar pattern reappears.
            </p>
          </div>
        </div>
      </section>

      {/* Secondary tagline band */}
      <section className="border-y border-border/60 bg-surface/60">
        <div className="mx-auto max-w-4xl px-6 py-16 text-center">
          <p className="text-2xl font-semibold tracking-tight text-foreground md:text-3xl">
            Stop your models from learning from the future.
          </p>
          <Link
            to="/app/audit"
            className="mt-7 inline-flex h-10 items-center rounded-lg border border-border bg-secondary px-5 text-sm font-medium text-foreground transition-all hover:-translate-y-0.5 hover:border-foreground/20"
          >
            See it catch a leak
          </Link>
        </div>
      </section>

      <footer className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-3 px-6 py-8 text-xs text-muted-foreground md:flex-row">
        <Logo mark />
        <span>ChronoGuard · Epistemic Replay for Machine Learning · Powered by Hindsight Memory</span>
      </footer>
    </div>
  );
}
