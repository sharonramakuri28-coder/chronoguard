import type { Pattern } from "@/lib/types";

export function PatternCard({ pattern }: { pattern: Pattern }) {
  return (
    <div className="glass rounded-xl p-5 transition-all duration-300 hover:-translate-y-0.5 hover:border-hindsight/30">
      <div className="flex items-start justify-between gap-3">
        <h3 className="text-base font-semibold text-foreground">{pattern.name}</h3>
        <span className="shrink-0 rounded-md border border-hindsight/30 bg-hindsight-soft px-2 py-0.5 text-[11px] font-semibold text-hindsight">
          {pattern.evidenceCount} incidents
        </span>
      </div>

      <div className="mt-3 flex flex-wrap gap-1.5">
        {pattern.examples.map((ex) => (
          <span key={ex} className="rounded bg-secondary px-2 py-0.5 font-mono text-[11px] text-foreground/75">
            {ex}
          </span>
        ))}
      </div>

      <p className="mt-4 text-sm leading-relaxed text-foreground/90">
        <span className="font-semibold text-hindsight">Insight · </span>
        {pattern.insight}
      </p>
      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
        <span className="font-semibold text-foreground/70">Recommendation · </span>
        {pattern.recommendation}
      </p>
    </div>
  );
}
