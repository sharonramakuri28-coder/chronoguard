// Server-only helpers for ChronoGuard. Never import from client code.
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// New-format opaque sb_ keys are not JWTs: PostgREST rejects the default
// `Authorization: Bearer <key>` header. Send `apikey` instead.
function fetchShim(key: string): typeof fetch {
  return (input, init) => {
    const h = new Headers(init?.headers);
    if (h.get("Authorization") === `Bearer ${key}`) h.delete("Authorization");
    h.set("apikey", key);
    return fetch(input, { ...init, headers: h });
  };
}

export function getPublicClient(): SupabaseClient {
  const key = process.env["SUPABASE_PUBLISHABLE_KEY"]!;
  return createClient(process.env["SUPABASE_URL"]!, key, {
    auth: { persistSession: false, autoRefreshToken: false, storage: undefined },
    global: { fetch: fetchShim(key) },
  });
}

export async function getAdminClient(): Promise<SupabaseClient> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

// ---------- Column <-> concept matching (Hindsight recall) ----------

function normalize(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function bigrams(s: string): Set<string> {
  const out = new Set<string>();
  for (let i = 0; i < s.length - 1; i++) out.add(s.slice(i, i + 2));
  return out;
}

function dice(a: string, b: string): number {
  const A = bigrams(a);
  const B = bigrams(b);
  if (!A.size || !B.size) return 0;
  let inter = 0;
  for (const g of A) if (B.has(g)) inter++;
  return (2 * inter) / (A.size + B.size);
}

export interface ConceptLike {
  name: string;
  aliases: string[];
  temporalRule: string;
  postOutcome: boolean;
}

export interface ColumnMatch {
  column: string;
  matchType: "exact" | "semantic" | "none";
  concept: string | null;
  risk: "high" | "medium" | "low" | "safe";
  similarity: number;
  temporalRule: string | null;
}

export function matchColumns(columns: string[], concepts: ConceptLike[]): ColumnMatch[] {
  return columns.map((column) => {
    const norm = normalize(column);
    let best: { concept: ConceptLike; score: number; exact: boolean } | null = null;

    for (const concept of concepts) {
      for (const alias of concept.aliases) {
        const aliasNorm = normalize(alias);
        if (norm === aliasNorm) {
          if (!best || aliasNorm.length > normalize(best.concept.aliases[0] ?? "").length || !best.exact) {
            best = { concept, score: 1, exact: true };
          }
          continue;
        }
        // containment: "riskscore" inside "merchantriskscore"
        const contained = aliasNorm.includes(norm) || norm.includes(aliasNorm);
        const score = contained
          ? Math.min(0.85, 0.55 + Math.min(norm.length, aliasNorm.length) / Math.max(norm.length, aliasNorm.length) * 0.3)
          : dice(norm, aliasNorm);
        if (score >= 0.55 && (!best || (!best.exact && score > best.score))) {
          best = { concept, score, exact: false };
        }
      }
    }

    if (best?.exact) {
      return {
        column,
        matchType: "exact" as const,
        concept: best.concept.name,
        risk: best.concept.postOutcome ? ("high" as const) : ("safe" as const),
        similarity: 1,
        temporalRule: best.concept.temporalRule,
      };
    }
    if (best) {
      return {
        column,
        matchType: "semantic" as const,
        concept: best.concept.name,
        risk: best.concept.postOutcome ? ("high" as const) : ("medium" as const),
        similarity: Number(best.score.toFixed(2)),
        temporalRule: best.concept.temporalRule,
      };
    }
    return { column, matchType: "none" as const, concept: null, risk: "low" as const, similarity: 0, temporalRule: null };
  });
}

// ---------- Point-in-time availability knowledge ----------

interface AvailabilityRule {
  availability: string;
  status: "safe" | "leakage" | "warning";
}

const AVAILABILITY: Record<string, AvailabilityRule> = {
  "GDP Growth": { availability: "Later revision used", status: "leakage" },
  "Payroll Growth": { availability: "Revised 7 days after decision", status: "leakage" },
  "Consumer Price Index": { availability: "Revised 15 days after decision", status: "leakage" },
  "Unemployment Rate": { availability: "Available at decision time", status: "safe" },
  "Interest Rate": { availability: "Available at decision time", status: "safe" },
  gdp_revised: { availability: "March 20 revision unavailable on March 01", status: "leakage" },
  chargeback_status: { availability: "Available 7–30 days AFTER transaction", status: "leakage" },
  cb_resolution: { availability: "Available 7–30 days AFTER transaction", status: "leakage" },
  dispute_outcome: { availability: "Available after dispute is resolved", status: "leakage" },
  manual_review_outcome: { availability: "Available after review decision", status: "leakage" },
  review_outcome: { availability: "Available after review decision", status: "leakage" },
  refund_result: { availability: "Available 12 days after scoring event", status: "leakage" },
  case_resolution: { availability: "Available when the case closes", status: "leakage" },
  gdp_final: { availability: "Later revision used", status: "leakage" },
  payroll_revision: { availability: "Revised 7 days after decision", status: "leakage" },
  unemployment_revision: { availability: "Revised after the decision window", status: "warning" },
  inflation_final: { availability: "Revised 15 days after decision", status: "leakage" },
  cpi_revised: { availability: "Revised 15 days after decision", status: "leakage" },
  merchant_risk_score: { availability: "Available 6 hours before prediction", status: "safe" },
  transaction_amount: { availability: "Available at prediction time", status: "safe" },
  txn_value: { availability: "Available at prediction time", status: "safe" },
  customer_age: { availability: "Available before prediction", status: "safe" },
  device_fingerprint: { availability: "Captured at transaction time", status: "safe" },
  session_duration: { availability: "Truncated at prediction time", status: "safe" },
};

export function availabilityFor(feature: string, concepts: ConceptLike[]): AvailabilityRule {
  const hit = AVAILABILITY[feature];
  if (hit) return hit;
  const concept = concepts.find((c) => c.aliases.includes(feature));
  if (concept) {
    return {
      availability: concept.postOutcome ? concept.temporalRule : "Available at decision time",
      status: concept.postOutcome ? "leakage" : "safe",
    };
  }
  return { availability: "Available before prediction", status: "safe" };
}
