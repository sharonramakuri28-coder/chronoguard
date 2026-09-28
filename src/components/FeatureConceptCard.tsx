import type { FeatureConcept } from "@/lib/types";
import { cn } from "@/lib/utils";

export function FeatureConceptCard({ concept }: { concept: FeatureConcept }) {
  return (
    <div
      className={cn(
        "glass rounded-xl p-5 transition-all duration-300 hover:-translate-y-0.5",
        concept.postOutcome ? "hover:border-leak/30" : "hover:border-safe/30",
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <h3 className="text-base font-semibold text-foreground">{concept.name}</h3>
        <span
          className={cn(
            "shrink-0 rounded-md border px-2 py-0.5 text-[11px] font-semibold",
            concept.postOutcome
              ? "border-leak/30 bg-leak-soft text-leak"
              : "border-safe/30 bg-safe-soft text-safe",
          )}
        >
          {concept.postOutcome ? "Post-outcome" : "Point-in-time"}
        </span>
      </div>

      <div className="mt-2 flex items-center gap-2 text-[11px] text-muted-foreground">
        <span>Temporal rule</span>
        <span className="text-foreground/80">{concept.temporalRule}</span>
      </div>

      <div className="mt-4">
        <p className="text-[11px] font-medium uppercase tracking-widest text-muted-foreground">Known aliases</p>
        <div className="mt-1.5 flex flex-wrap gap-1.5">
          {concept.aliases.map((a) => (
            <span key={a} className="rounded bg-secondary px-2 py-0.5 font-mono text-[11px] text-foreground/75">
              {a}
            </span>
          ))}
        </div>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3 text-xs">
        <div className="rounded-lg border border-leak/20 bg-leak-soft/50 p-2.5">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-leak">Unsafe for</p>
          <p className="mt-1 text-foreground/80">{concept.unsafeFor}</p>
        </div>
        <div className="rounded-lg border border-safe/20 bg-safe-soft/50 p-2.5">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-safe">Safe for</p>
          <p className="mt-1 text-foreground/80">{concept.safeFor}</p>
        </div>
      </div>

      <p className="mt-3 text-[11px] text-hindsight">{concept.evidenceCount} supporting memories</p>
    </div>
  );
}
