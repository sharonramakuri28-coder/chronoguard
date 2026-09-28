// Server-only Hindsight integration. Hindsight stores what the team LEARNED
// (lessons, corrections, reasons, recurring patterns). Postgres stays the
// source of truth for deterministic data (timestamps, availability, replay numbers).
import { HindsightClient } from "@vectorize-io/hindsight-client";

const DEFAULT_BANK = "chronoguard-demo";
let bankReady: Promise<void> | null = null;

function config() {
  const baseUrl = process.env["HINDSIGHT_API_URL"];
  const apiKey = process.env["HINDSIGHT_API_KEY"];
  const bankId = process.env["HINDSIGHT_BANK_ID"] || DEFAULT_BANK;
  if (!baseUrl || !apiKey) return null;
  return { client: new HindsightClient({ baseUrl: baseUrl.replace(/\/$/, ""), apiKey }), bankId };
}

async function ready() {
  const cfg = config();
  if (!cfg) throw new Error("Hindsight is not configured");
  if (!bankReady) {
    bankReady = cfg.client
      .createBank(cfg.bankId, {
        name: "ChronoGuard Demo",
        mission:
          "Remember temporal-leakage lessons for ML teams: which features used information unavailable at decision time, why, and how to prevent recurrence.",
      } as never)
      .then(() => undefined)
      .catch(() => undefined); // bank may already exist
  }
  await bankReady;
  return cfg;
}

export async function checkHindsightConnection(): Promise<{ connected: boolean; error?: string }> {
  try {
    const { client, bankId } = await ready();
    await client.listMemories(bankId, { limit: 1 });
    return { connected: true };
  } catch (e) {
    console.error("[hindsight] connection check failed", e);
    return { connected: false, error: e instanceof Error ? e.message : "unavailable" };
  }
}

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9%.]+/g, " ").trim();

/** Stable id for (project, indicator, leakage type, temporal rule) so repeated retains are idempotent. */
async function lessonId(parts: string[]) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(parts.map(norm).join("|")));
  return "lesson-" + Array.from(new Uint8Array(buf).slice(0, 12), (b) => b.toString(16).padStart(2, "0")).join("");
}

export async function retainLeakageMemory(input: {
  content: string;
  rule: string;
  feature: string;
  domain: string;
  experiment?: string;
}): Promise<{ status: "exists" | "retained"; lessonId: string; bankId: string }> {
  const { client, bankId } = await ready();
  const leakageType = "revision-leakage";
  const id = await lessonId(["chronoguard", input.feature, leakageType, input.rule]);

  // Equivalent lesson already stored? Then do not create a duplicate.
  const existing = await client.listMemories(bankId, { documentId: id, limit: 1 });
  if (existing.total > 0 || existing.items.length > 0) return { status: "exists", lessonId: id, bankId };

  // Is there an earlier lesson for the same indicator? Mark this one as an update.
  const prior = await client.recall(bankId, `ChronoGuard leakage rule for feature "${input.feature}"`, {
    tags: [`feature:${input.feature}`],
    tagsMatch: "all_strict",
    maxTokens: 256,
  }).catch(() => ({ results: [] as unknown[] }));
  const isUpdate = prior.results.length > 0;

  const res = await client.retain(bankId, input.content, {
    documentId: id,
    updateMode: "replace",
    context: isUpdate
      ? `Updated ChronoGuard leakage lesson for ${input.feature}: adds new evidence or changes the earlier rule.`
      : "ChronoGuard temporal-leakage lesson taught by a senior data scientist",
    timestamp: new Date(),
    metadata: {
      project: "chronoguard",
      domain: input.domain,
      type: "leakage-rule",
      leakage_type: leakageType,
      feature: input.feature,
      lesson_id: id,
      revision: isUpdate ? "update" : "original",
      ...(input.experiment ? { experiment: input.experiment } : {}),
    },
    tags: ["project:chronoguard", `domain:${input.domain}`, "type:leakage-rule", `feature:${input.feature}`, `lesson:${id}`],
  });
  if (!res.success) throw new Error("Hindsight retain did not succeed");
  return { status: "retained", lessonId: id, bankId: res.bank_id };
}

export async function recallLeakageMemories(query: string) {
  const { client, bankId } = await ready();
  const res = await client.recall(bankId, query, { budget: "mid" as never, maxTokens: 2048 });
  return res.results.map((r) => ({ id: r.id, text: r.text, type: r.type ?? null }));
}

export async function reflectLeakageHistory(query: string) {
  const { client, bankId } = await ready();
  const res = await client.reflect(bankId, query, { budget: "mid" as never });
  return { text: res.text };
}
