import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Brain, History, ShieldAlert } from "lucide-react";
import { reauditEventsQuery } from "@/lib/queries";
import { createMemoryRule, runReAudit } from "@/lib/chrono.functions";
import { retainHindsightLesson } from "@/lib/hindsight.functions";
import { StatusBadge } from "@/components/StatusBadge";
import { AnimatedNumber } from "@/components/AnimatedNumber";
import { cn } from "@/lib/utils";
import type { ReauditEvent } from "@/lib/types";

export const Route = createFileRoute("/app/reaudit")({
  head: () => ({ meta: [
    { title: "Knowledge Replay | ChronoGuard" },
    { name: "description", content: "Retain temporal leakage lessons and re-audit experiments with organizational memory." },
    { property: "og:title", content: "ChronoGuard Knowledge Replay" },
    { property: "og:description", content: "Apply retained lessons to previous experiments and future data." },
    { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" },
  ] }),
  component: ReAudit,
});

const PREFILL_FEATURE = "GDP Growth";
const PREFILL_LESSON =
  "Use the preliminary GDP Growth value known on March 01; the 1.2% revision was published March 20, 19 days later.";

function ReAudit() {
  const queryClient = useQueryClient();
  const { data: events } = useQuery(reauditEventsQuery);

  const [feature, setFeature] = useState(PREFILL_FEATURE);
  const [lesson, setLesson] = useState(PREFILL_LESSON);
  const [stage, setStage] = useState<"form" | "remembered" | "reaudited">("form");
  const [pending, setPending] = useState(false);
  const [affected, setAffected] = useState<{ slug: string; name: string; accuracy: number; feature: string }[]>([]);
  const [memoryId, setMemoryId] = useState<string | null>(null);
  const [doneEvents, setDoneEvents] = useState<ReauditEvent[]>([]);
  const [realRetained, setRealRetained] = useState(false);
  const [alreadyExists, setAlreadyExists] = useState(false);
  const [lessonId, setLessonId] = useState<string | null>(null);

  const createMemoryFn = useServerFn(createMemoryRule);
  const runReAuditFn = useServerFn(runReAudit);
  const retainFn = useServerFn(retainHindsightLesson);

  const retain = async () => {
    setPending(true);
    const hs = await retainFn({ data: { feature, lesson } });
    setRealRetained(hs.ok);
    setAlreadyExists(hs.ok && hs.status === "exists");
    setLessonId(hs.ok ? hs.lessonId : null);
    // Mirror a reference in the database for UI history + affected-experiment lookup.
    const res = await createMemoryFn({ data: { feature, lesson } });
    setMemoryId(res.memory.id);
    setAffected(res.affected);
    setStage("remembered");
    setPending(false);
    queryClient.invalidateQueries({ queryKey: ["memories"] });
    queryClient.invalidateQueries({ queryKey: ["overview"] });
  };

  const reaudit = async () => {
    if (!memoryId) return;
    setPending(true);
    const ev = await runReAuditFn({ data: { memoryId, feature, lesson } });
    setDoneEvents((prev) => [ev, ...prev]);
    setStage("reaudited");
    setPending(false);
    queryClient.invalidateQueries({ queryKey: ["reaudit-events"] });
    queryClient.invalidateQueries({ queryKey: ["experiments"] });
    queryClient.invalidateQueries({ queryKey: ["overview"] });
  };

  return (
    <div className="mx-auto max-w-4xl space-y-5">
      <div>
        <h1 className="text-xl font-semibold tracking-tight text-foreground">Knowledge Replay</h1>
        <p className="mt-1 text-xs text-muted-foreground">
          New organizational knowledge changes how historical experiments should be evaluated — retroactively.
        </p>
      </div>

      {/* Step 1: add rule */}
      <div className="glass rounded-xl p-5">
        <div className="flex items-center gap-2">
          <span className="grid size-7 place-items-center rounded-md border border-hindsight/30 bg-hindsight-soft">
            <Brain className="size-4 text-hindsight" />
          </span>
          <h2 className="text-sm font-semibold text-foreground">Teach Hindsight a new rule</h2>
        </div>
        <p className="mt-1.5 text-xs text-muted-foreground">
          A senior data scientist contributes knowledge the system didn't have.
        </p>

        <div className="mt-4 space-y-3">
          <div>
            <label className="text-[11px] font-medium uppercase tracking-widest text-muted-foreground">Feature</label>
            <input
              value={feature}
              onChange={(e) => setFeature(e.target.value)}
              className="mt-1 h-9 w-full rounded-lg border border-border bg-card px-3 font-mono text-xs text-foreground focus:border-hindsight/40 focus:outline-none"
            />
          </div>
          <div>
            <label className="text-[11px] font-medium uppercase tracking-widest text-muted-foreground">Rule / lesson</label>
            <textarea
              value={lesson}
              onChange={(e) => setLesson(e.target.value)}
              rows={3}
              className="mt-1 w-full rounded-lg border border-border bg-card px-3 py-2 text-[13px] leading-relaxed text-foreground focus:border-hindsight/40 focus:outline-none"
            />
          </div>
          {stage === "form" && (
            <button
              onClick={retain}
              disabled={pending || !feature.trim() || !lesson.trim()}
              className="inline-flex h-9 items-center gap-2 rounded-lg bg-primary px-4 text-[13px] font-semibold text-primary-foreground transition-all hover:-translate-y-0.5 disabled:opacity-50"
            >
              {pending ? "Retaining…" : "Retain as Hindsight Memory"}
            </button>
          )}
        </div>
      </div>

      {/* Step 2: memory created + affected */}
      {stage !== "form" && (
        <div
          className={cn(
            "glass rounded-xl p-5 animate-rise",
            realRetained ? "border-hindsight/40 animate-pulse-memory aurora-glow" : "border-warn/30",
          )}
        >
          <div className="flex items-center gap-2">
            <Brain className={cn("size-4", realRetained ? "text-hindsight" : "text-warn")} />
            <h2 className={cn("text-sm font-bold uppercase tracking-widest", realRetained ? "text-hindsight" : "text-warn")}>
              {realRetained
                ? alreadyExists
                  ? "Lesson already exists in Hindsight memory."
                  : "Real Hindsight Memory Retained"
                : "Demo Memory Fallback · saved locally"}
            </h2>
          </div>
          <p className="mt-2 text-sm text-foreground/90">“{lesson}”</p>
          <p className="mt-2 font-mono text-[10px] text-muted-foreground">
            {realRetained
              ? `lesson_id: ${lessonId} · ` + "bank: chronoguard-demo · tags: project:chronoguard · domain:macro · type:leakage-rule · feature:" + feature
              : "Hindsight was unreachable — the lesson was stored in the local demo memory only."}
          </p>
        </div>
      )}

      {stage !== "form" && (
        <div className="glass rounded-xl border-warn/30 p-5 animate-rise">
          <div className="flex items-center gap-2">
            <ShieldAlert className="size-4 text-warn" />
            <h2 className="text-sm font-bold uppercase tracking-widest text-warn">
              {affected.length} Past Experiments May Be Affected
            </h2>
          </div>

          {affected.length > 0 ? (
            <>
              <div className="mt-4 space-y-2">
                {affected.map((a, i) => (
                  <div
                    key={a.slug}
                    className="flex items-center justify-between rounded-lg border border-warn/20 bg-warn-soft/50 px-4 py-3 animate-rise"
                    style={{ animationDelay: `${i * 120}ms` }}
                  >
                    <div>
                      <p className="text-sm font-medium text-foreground">{a.name}</p>
                      <p className="font-mono text-[11px] text-muted-foreground">used {a.feature}</p>
                    </div>
                    <span className="num text-lg font-semibold text-foreground">
                      +<AnimatedNumber value={a.accuracy} suffix="%" />
                    </span>
                  </div>
                ))}
              </div>

              <p className="mt-4 rounded-lg border border-border bg-surface px-3 py-2.5 text-[13px] leading-relaxed text-foreground/90">
                New organizational knowledge changed how these historical experiments should be evaluated.{" "}
                <span className="text-muted-foreground">
                  What was knowable at the time has not changed. Our present-day evaluation of these experiments has.
                </span>
              </p>

              {stage === "remembered" && (
                <button
                  onClick={reaudit}
                  disabled={pending}
                  className="mt-4 inline-flex h-9 items-center gap-2 rounded-lg bg-primary px-4 text-[13px] font-semibold text-primary-foreground transition-all hover:-translate-y-0.5 disabled:opacity-50"
                >
                  <History className="size-4" />
                  {pending ? "Re-auditing…" : "Re-Audit Historical Experiments"}
                </button>
              )}
            </>
          ) : (
            <p className="mt-3 text-sm text-muted-foreground">
              No historical experiments used this feature. The memory is retained for future dataset scans.
            </p>
          )}
        </div>
      )}

      {/* Step 3: results */}
      {stage === "reaudited" && doneEvents.map((ev) => <ReAuditResult key={ev.id} event={ev} />)}

      {/* History */}
      {(events ?? []).filter((e) => !doneEvents.some((d) => d.id === e.id)).length > 0 && (
        <div className="glass rounded-xl p-5">
          <h2 className="text-sm font-semibold text-foreground">Past re-audits</h2>
          <div className="mt-3 space-y-2">
            {(events ?? [])
              .filter((e) => !doneEvents.some((d) => d.id === e.id))
              .map((ev) => (
                <div key={ev.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 rounded-lg border border-border bg-surface px-4 py-2.5 text-xs">
                  <span className="text-muted-foreground">
                    {new Date(ev.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                  </span>
                  <span className="font-mono text-foreground/75">{ev.feature}</span>
                  <span className="text-muted-foreground">
                    {ev.affected.length} experiment{ev.affected.length === 1 ? "" : "s"} flagged
                  </span>
                  <StatusBadge variant="review">Re-Audit</StatusBadge>
                </div>
              ))}
          </div>
        </div>
      )}
    </div>
  );
}

function ReAuditResult({ event }: { event: ReauditEvent }) {
  return (
    <div className="glass rounded-xl border-hindsight/30 p-5 animate-rise">
      <div className="flex items-center gap-2">
        <History className="size-4 text-hindsight" />
        <h2 className="text-sm font-bold uppercase tracking-widest text-hindsight">Re-Audit Complete</h2>
      </div>
      <p className="mt-2 text-sm text-muted-foreground">
        Rule applied retroactively: <span className="font-mono text-foreground/80">{event.feature}</span>
      </p>
      <div className="mt-4 grid gap-2 sm:grid-cols-2">
        {event.affected.map((a, i) => (
          <div
            key={a.slug}
            className="rounded-lg border border-hindsight/20 bg-hindsight-soft/60 px-4 py-3 animate-rise"
            style={{ animationDelay: `${i * 140}ms` }}
          >
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-foreground">{a.name}</p>
              <span className="num text-sm font-semibold text-hindsight">+{a.accuracy}%</span>
            </div>
            <p className="mt-1 text-[11px] text-muted-foreground">
              Present-day evaluation updated — reported return now carries a leakage caveat.
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
