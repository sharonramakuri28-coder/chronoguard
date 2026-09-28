import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import {
  getPublicClient,
  getAdminClient,
  matchColumns,
  availabilityFor,
  type ConceptLike,
} from "./chrono.server";
import type {
  AuditFinding,
  AuditRun,
  DatasetFinding,
  DatasetScan,
  Experiment,
  FeatureConcept,
  LeakageIncident,
  Memory,
  OverviewStats,
  Pattern,
  ReauditEvent,
  ReplayResult,
} from "./types";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Row = any;

function toExperiment(r: Row): Experiment {
  return {
    id: r.id,
    slug: r.slug,
    name: r.name,
    model: r.model,
    dataset: r.dataset,
    accuracy: Number(r.accuracy),
    temporalStatus: r.temporal_status,
    leakageRisks: r.leakage_risks,
    ranAt: r.ran_at,
    status: r.status,
    featuresUsed: r.features_used ?? [],
    reauditFlag: r.reaudit_flag,
  };
}

function toMemory(r: Row): Memory {
  return {
    id: r.id,
    learnedAt: r.learned_at,
    experiment: r.experiment,
    feature: r.feature,
    concept: r.concept,
    lesson: r.lesson,
    reason: r.reason,
    outcome: r.outcome,
    evidenceCount: r.evidence_count,
    confidence: Number(r.confidence),
    tags: r.tags ?? [],
    memoryType: r.memory_type,
  };
}

function toConcept(r: Row): FeatureConcept {
  return {
    id: r.id,
    name: r.name,
    aliases: r.aliases ?? [],
    temporalRule: r.temporal_rule,
    unsafeFor: r.unsafe_for,
    safeFor: r.safe_for,
    evidenceCount: r.evidence_count,
    postOutcome: r.post_outcome,
  };
}

// ============= GET /api/experiments =============
export const listExperiments = createServerFn({ method: "GET" }).handler(async () => {
  const db = getPublicClient();
  const [{ data, error }, audit] = await Promise.all([
    db.from("experiments").select("*").order("ran_at", { ascending: false }),
    calculateDatasetAudit("MacroAlpha-v4"),
  ]);
  if (error) throw new Error(error.message);
  return data.map((row) => {
    const exp = toExperiment(row);
    return exp.slug === "macroalpha-v4" ? { ...exp, accuracy: audit.originalReturn, leakageRisks: audit.leakCount } : exp;
  });
});

// ============= GET /api/experiments/:id =============
export const getExperiment = createServerFn({ method: "GET" })
  .inputValidator((input: { slug: string }) => z.object({ slug: z.string() }).parse(input))
  .handler(async ({ data }) => {
    const db = getPublicClient();
    const [{ data: row, error }, audit] = await Promise.all([
      db.from("experiments").select("*").eq("slug", data.slug).maybeSingle(),
      data.slug === "macroalpha-v4" ? calculateDatasetAudit("MacroAlpha-v4") : Promise.resolve(null),
    ]);
    if (error) throw new Error(error.message);
    if (!row) return null;
    const exp = toExperiment(row);
    return audit ? { ...exp, accuracy: audit.originalReturn, leakageRisks: audit.leakCount } : exp;
  });

// ============= GET /api/overview =============
export const getOverview = createServerFn({ method: "GET" }).handler(async () => {
  const db = getPublicClient();
  const [exps, memCount, lastRun, lastReplay, audit] = await Promise.all([
    db.from("experiments").select("*"),
    db.from("memories").select("id", { count: "exact", head: true }),
    db.from("audit_runs").select("*").eq("experiment_slug", "macroalpha-v4").order("created_at", { ascending: false }).limit(1).maybeSingle(),
    db.from("replay_results").select("*").eq("experiment_slug", "macroalpha-v4").order("created_at", { ascending: false }).limit(1).maybeSingle(),
    calculateDatasetAudit("MacroAlpha-v4"),
  ]);

  const experiments = (exps.data ?? []).map(toExperiment);

  return {
    stats: {
      modelAccuracy: audit.originalReturn,
      correctedAccuracy: audit.correctedReturn,
      leakCount: audit.leakCount,
      memoryCount: memCount.count ?? 0,
      reauditCount: audit.leakedFeatures,
      hasAuditRun: Boolean(lastRun.data),
      hasReplay: Boolean(lastReplay.data),
    } satisfies OverviewStats,
    experiments: experiments.map((exp) => exp.slug === "macroalpha-v4" ? { ...exp, accuracy: audit.originalReturn, leakageRisks: audit.leakCount } : exp),
  };
});

// ============= GET /api/memories =============
export const listMemories = createServerFn({ method: "GET" }).handler(async () => {
  const db = getPublicClient();
  const { data, error } = await db.from("memories").select("*").order("learned_at", { ascending: false });
  if (error) throw new Error(error.message);
  return data.map(toMemory);
});

// ============= GET /api/patterns =============
export const listPatterns = createServerFn({ method: "GET" }).handler(async () => {
  const db = getPublicClient();
  const { data, error } = await db.from("patterns").select("*").order("evidence_count", { ascending: false });
  if (error) throw new Error(error.message);
  return (data as Row[]).map(
    (r): Pattern => ({
      id: r.id,
      name: r.name,
      evidenceCount: r.evidence_count,
      examples: r.examples ?? [],
      insight: r.insight,
      recommendation: r.recommendation,
    }),
  );
});

// ============= GET /api/feature-concepts =============
export const listFeatureConcepts = createServerFn({ method: "GET" }).handler(async () => {
  const db = getPublicClient();
  const { data, error } = await db.from("feature_concepts").select("*").order("evidence_count", { ascending: false });
  if (error) throw new Error(error.message);
  return data.map(toConcept);
});

// ============= GET /api/incidents =============
export const listIncidents = createServerFn({ method: "GET" }).handler(async () => {
  const db = getPublicClient();
  const { data, error } = await db.from("leakage_incidents").select("*").order("detected_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data as Row[]).map(
    (r): LeakageIncident => ({
      id: r.id,
      experiment: r.experiment,
      feature: r.feature,
      description: r.description,
      severity: r.severity,
      detectedAt: r.detected_at,
    }),
  );
});

async function getConcepts(): Promise<ConceptLike[]> {
  const db = getPublicClient();
  const { data } = await db.from("feature_concepts").select("*");
  return (data ?? []).map(toConcept);
}

// ============= GET /api/audit?experiment=slug =============
export const getAuditRun = createServerFn({ method: "GET" })
  .inputValidator((input: { slug: string }) => z.object({ slug: z.string() }).parse(input))
  .handler(async ({ data }) => {
    const db = getPublicClient();
    const { data: row } = await db
      .from("audit_runs")
      .select("*")
      .eq("experiment_slug", data.slug)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (!row) return null;
    return {
      id: row.id,
      experimentSlug: row.experiment_slug,
      findings: row.findings as AuditFinding[],
      leakCount: data.slug === "macroalpha-v4" ? (await calculateDatasetAudit("MacroAlpha-v4")).leakCount : row.leak_count,
      createdAt: row.created_at,
    } satisfies AuditRun;
  });

// ============= POST /api/audit =============
export const runAudit = createServerFn({ method: "POST" })
  .inputValidator((input: { slug: string }) => z.object({ slug: z.string() }).parse(input))
  .handler(async ({ data }) => {
    const db = getPublicClient();
    const { data: exp } = await db.from("experiments").select("*").eq("slug", data.slug).maybeSingle();
    if (!exp) throw new Error("Experiment not found");
    const concepts = await getConcepts();

    const findings: AuditFinding[] = (exp.features_used as string[]).map((feature) => {
      const rule = availabilityFor(feature, concepts);
      return { feature, availability: rule.availability, status: rule.status };
    });
    const leakCount = data.slug === "macroalpha-v4" ? (await calculateDatasetAudit("MacroAlpha-v4")).leakCount : findings.filter((f) => f.status === "leakage").length;

    const admin = await getAdminClient();
    const { data: run, error } = await admin
      .from("audit_runs")
      .insert({ experiment_slug: data.slug, findings, leak_count: leakCount })
      .select()
      .single();
    if (error) throw new Error(error.message);

    // Other experiments also get a corrected return on replay-worthy audits
    return {
      id: run.id,
      experimentSlug: run.experiment_slug,
      findings: run.findings as AuditFinding[],
      leakCount: run.leak_count,
      createdAt: run.created_at,
    } satisfies AuditRun;
  });

// ============= POST /api/replay =============
export const runReplay = createServerFn({ method: "POST" })
  .inputValidator((input: { slug: string }) => z.object({ slug: z.string() }).parse(input))
  .handler(async ({ data }) => {
    const db = getPublicClient();
    const { data: exp } = await db.from("experiments").select("*").eq("slug", data.slug).maybeSingle();
    if (!exp) throw new Error("Experiment not found");

    const datasetAudit = data.slug === "macroalpha-v4" ? await calculateDatasetAudit("MacroAlpha-v4") : null;
    const original = datasetAudit?.originalReturn ?? Number(exp.accuracy);
    // Deterministic knowledge-correction: remove the inflation future knowledge caused.
    const corrected = datasetAudit?.correctedReturn ?? Math.round((original * 0.836 + 0.4) * 10) / 10;

    const admin = await getAdminClient();
    const { data: row, error } = await admin
      .from("replay_results")
      .insert({ experiment_slug: data.slug, original_accuracy: original, corrected_accuracy: corrected })
      .select()
      .single();
    if (error) throw new Error(error.message);
    return {
      id: row.id,
      experimentSlug: row.experiment_slug,
      originalAccuracy: Number(row.original_accuracy),
      correctedAccuracy: Number(row.corrected_accuracy),
      createdAt: row.created_at,
    } satisfies ReplayResult;
  });

export const getReplayResult = createServerFn({ method: "GET" })
  .inputValidator((input: { slug: string }) => z.object({ slug: z.string() }).parse(input))
  .handler(async ({ data }) => {
    const db = getPublicClient();
    const { data: row } = await db
      .from("replay_results")
      .select("*")
      .eq("experiment_slug", data.slug)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (!row) return null;
    const datasetAudit = data.slug === "macroalpha-v4" ? await calculateDatasetAudit("MacroAlpha-v4") : null;
    return {
      id: row.id,
      experimentSlug: row.experiment_slug,
      originalAccuracy: datasetAudit?.originalReturn ?? Number(row.original_accuracy),
      correctedAccuracy: datasetAudit?.correctedReturn ?? Number(row.corrected_accuracy),
      createdAt: row.created_at,
    } satisfies ReplayResult;
  });

// ============= POST /api/datasets/analyze =============
export const analyzeDataset = createServerFn({ method: "POST" })
  .inputValidator((input: { filename: string; columns: string[] }) =>
    z.object({ filename: z.string().min(1), columns: z.array(z.string().min(1)).min(1).max(200) }).parse(input),
  )
  .handler(async ({ data }) => {
    const db = getPublicClient();
    const concepts = await getConcepts();
    const matches = matchColumns(data.columns, concepts);

    // Attach the most recent supporting memory lesson for flagged columns.
    const findings: DatasetFinding[] = await Promise.all(
      matches.map(async (m) => {
        if (m.risk === "safe" || m.risk === "low") {
          return { ...m, lesson: null };
        }
        const concept = concepts.find((c) => c.name === m.concept);
        const { data: mem } = await db
          .from("memories")
          .select("lesson, evidence_count")
          .in("feature", concept?.aliases ?? [])
          .order("learned_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        return {
          column: m.column,
          matchType: m.matchType,
          concept: m.concept,
          lesson: mem?.lesson ?? null,
          risk: m.risk,
          similarity: m.similarity,
          temporalRule: m.temporalRule,
        };
      }),
    );

    const admin = await getAdminClient();
    const { data: row, error } = await admin
      .from("dataset_scans")
      .insert({ filename: data.filename, columns: data.columns, findings })
      .select()
      .single();
    if (error) throw new Error(error.message);

    return {
      id: row.id,
      filename: row.filename,
      columns: row.columns as string[],
      findings: row.findings as DatasetFinding[],
      decision: null,
      createdAt: row.created_at,
    } satisfies DatasetScan;
  });

// ============= POST /api/datasets/decision =============
export const recordScanDecision = createServerFn({ method: "POST" })
  .inputValidator((input: { scanId: string; decision: string }) =>
    z.object({ scanId: z.string().uuid(), decision: z.string().min(1) }).parse(input),
  )
  .handler(async ({ data }) => {
    const admin = await getAdminClient();
    await admin.from("dataset_scans").update({ decision: data.decision }).eq("id", data.scanId);
    return { ok: true };
  });

export const listDatasetScans = createServerFn({ method: "GET" }).handler(async () => {
  const db = getPublicClient();
  const { data } = await db.from("dataset_scans").select("*").order("created_at", { ascending: false }).limit(10);
  return (data as Row[] | null)?.map(
    (r): DatasetScan => ({
      id: r.id,
      filename: r.filename,
      columns: r.columns as string[],
      findings: r.findings as DatasetFinding[],
      decision: r.decision,
      createdAt: r.created_at,
    }),
  ) ?? [];
});

// ============= POST /api/memories/retain =============
export const createMemoryRule = createServerFn({ method: "POST" })
  .inputValidator((input: { feature: string; lesson: string }) =>
    z.object({ feature: z.string().min(1), lesson: z.string().min(1) }).parse(input),
  )
  .handler(async ({ data }) => {
    const db = getPublicClient();
    const concepts = await getConcepts();
    const concept = concepts.find((c) => c.aliases.includes(data.feature));
    const admin = await getAdminClient();

    const { data: mem, error } = await admin
      .from("memories")
      .insert({
        experiment: "Manual Entry",
        feature: data.feature,
        concept: concept?.name ?? "New Concept",
        lesson: data.lesson,
        reason: "Added by a senior data scientist via the Re-Audit console.",
        outcome: "New Hindsight memory created; historical experiments queued for re-audit.",
        evidence_count: 1,
        confidence: 0.95,
        tags: ["manual", "rule"],
        memory_type: "rule",
      })
      .select()
      .single();
    if (error) throw new Error(error.message);

    // Which past experiments used this feature?
    const { data: exps } = await db.from("experiments").select("*").contains("features_used", [data.feature]);
    const affected = (exps ?? []).map((r: Row) => ({
      slug: r.slug as string,
      name: r.name as string,
      accuracy: Number(r.accuracy),
      feature: data.feature,
    }));

    return { memory: toMemory(mem), affected };
  });

// ============= POST /api/reaudit =============
export const runReAudit = createServerFn({ method: "POST" })
  .inputValidator((input: { memoryId: string; feature: string; lesson: string }) =>
    z.object({ memoryId: z.string().uuid(), feature: z.string(), lesson: z.string() }).parse(input),
  )
  .handler(async ({ data }) => {
    const db = getPublicClient();
    const admin = await getAdminClient();

    const { data: exps } = await db.from("experiments").select("*").contains("features_used", [data.feature]);
    const affected = (exps ?? []).map((r: Row) => ({
      slug: r.slug as string,
      name: r.name as string,
      accuracy: Number(r.accuracy),
      feature: data.feature,
    }));

    const { data: event, error } = await admin
      .from("reaudit_events")
      .insert({ memory_id: data.memoryId, feature: data.feature, lesson: data.lesson, affected })
      .select()
      .single();
    if (error) throw new Error(error.message);

    // Flag affected experiments as requiring re-audit
    for (const a of affected) {
      await admin.from("experiments").update({ reaudit_flag: true, status: "Re-Audit" }).eq("slug", a.slug);
    }

    return {
      id: event.id,
      memoryId: event.memory_id,
      feature: event.feature,
      lesson: event.lesson,
      affected,
      createdAt: event.created_at,
    } satisfies ReauditEvent;
  });

export const listReauditEvents = createServerFn({ method: "GET" }).handler(async () => {
  const db = getPublicClient();
  const { data } = await db.from("reaudit_events").select("*").order("created_at", { ascending: false });
  return (data as Row[] | null)?.map(
    (r): ReauditEvent => ({
      id: r.id,
      memoryId: r.memory_id,
      feature: r.feature,
      lesson: r.lesson,
      affected: (r.affected ?? []) as ReauditEvent["affected"],
      createdAt: r.created_at,
    }),
  ) ?? [];
});

// ============= Demo dataset audit (chronoguard_final_production_demo_dataset.csv) =============
export type DatasetLeak = {
  decisionId: string;
  model: string;
  feature: string;
  decisionDate: string;
  availableDate: string;
  days: number;
  reason: string;
};
export type DatasetFeatureSummary = { feature: string; total: number; leaks: number; maxDays: number };
export type DatasetAuditResult = {
  model: string;
  decisions: number;
  leakCount: number;
  leakedFeatures: number;
  features: DatasetFeatureSummary[];
  leaks: DatasetLeak[];
  primary: DatasetLeak | null;
  originalReturn: number;
  correctedReturn: number;
  distortion: number;
};

export const listDatasetModels = createServerFn({ method: "GET" }).handler(async () => {
  const db = getPublicClient();
  const { data, error } = await db.from("demo_decisions").select("model_name");
  if (error) throw new Error(error.message);
  return Array.from(new Set((data as Row[]).map((r) => r.model_name as string))).sort();
});

export const runDatasetAudit = createServerFn({ method: "POST" })
  .inputValidator((i: { model: string }) => z.object({ model: z.string().min(1).max(100) }).parse(i))
  .handler(async ({ data }): Promise<DatasetAuditResult> => calculateDatasetAudit(data.model));

async function calculateDatasetAudit(model: string): Promise<DatasetAuditResult> {
    const db = getPublicClient();
    let q = db.from("demo_decisions").select("*").order("decision_date", { ascending: true }).limit(5000);
    if (model !== "all") q = q.eq("model_name", model);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    const list = rows as Row[];
    const DAY = 86400000;
    const byFeature = new Map<string, DatasetFeatureSummary>();
    const leaks: DatasetLeak[] = [];
    let orig = 0;
    let corr = 0;
    for (const r of list) {
      const d = new Date(r.decision_date as string).getTime();
      const a = new Date(r.available_date as string).getTime();
      const isLeak = a > d; // RULE: available_date > decision_date => future information leakage
      const days = isLeak ? Math.round((a - d) / DAY) : 0;
      const f = byFeature.get(r.feature_name) ?? { feature: r.feature_name, total: 0, leaks: 0, maxDays: 0 };
      f.total++;
      orig += Number(r.original_backtest_return);
      corr += isLeak ? Number(r.knowledge_correct_return) : Number(r.original_backtest_return);
      if (isLeak) {
        f.leaks++;
        f.maxDays = Math.max(f.maxDays, days);
        leaks.push({
          decisionId: r.decision_id,
          model: r.model_name,
          feature: r.feature_name,
          decisionDate: r.decision_date,
          availableDate: r.available_date,
          days,
          reason: r.leakage_reason,
        });
      }
      byFeature.set(r.feature_name, f);
    }
    const n = list.length || 1;
    const originalReturn = Math.round((orig / n) * 10) / 10;
    const correctedReturn = Math.round((corr / n) * 10) / 10;
    const features = Array.from(byFeature.values()).sort((x, y) => y.leaks - x.leaks || x.feature.localeCompare(y.feature));
    const primary =
      leaks.find((l) => l.feature === "GDP_final_revision" && l.decisionDate === "2025-03-01") ??
      [...leaks].sort((x, y) => y.days - x.days)[0] ??
      null;
    return {
      model,
      decisions: list.length,
      leakCount: leaks.length,
      leakedFeatures: features.filter((f) => f.leaks > 0).length,
      features,
      leaks,
      primary,
      originalReturn,
      correctedReturn,
      distortion: Math.round((originalReturn - correctedReturn) * 10) / 10,
    };
}
