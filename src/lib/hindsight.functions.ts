import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import {
  checkHindsightConnection,
  recallLeakageMemories,
  reflectLeakageHistory,
  retainLeakageMemory,
} from "./hindsight.server";

export const getHindsightStatus = createServerFn({ method: "GET" }).handler(async () => {
  const { connected } = await checkHindsightConnection();
  return { connected };
});

export const retainHindsightLesson = createServerFn({ method: "POST" })
  .inputValidator((i: { feature: string; lesson: string }) =>
    z.object({ feature: z.string().min(1).max(200), lesson: z.string().min(1).max(4000) }).parse(i),
  )
  .handler(async ({ data }) => {
    try {
      const content = `ChronoGuard leakage rule for feature "${data.feature}": ${data.lesson} Using a later revision of a revision-sensitive macro indicator in a historical backtest is future-information leakage.`;
      const r = await retainLeakageMemory({ content, rule: data.lesson, feature: data.feature, domain: "macro", experiment: "MacroAlpha-v4" });
      return { ok: true as const, bankId: r.bankId, status: r.status, lessonId: r.lessonId };
    } catch (e) {
      console.error("[hindsight] retain failed", e);
      return { ok: false as const, error: "Hindsight retain failed" };
    }
  });

export const recallForDataset = createServerFn({ method: "POST" })
  .inputValidator((i: { filename: string; columns: string[] }) =>
    z.object({ filename: z.string().max(300), columns: z.array(z.string().max(200)).max(200) }).parse(i),
  )
  .handler(async ({ data }) => {
    const query = `We are analyzing a new macro dataset (${data.filename}) with columns: ${data.columns.join(", ")}. Recall previous lessons about semantically related revised, final, or later-published economic indicators (GDP, payrolls, CPI, unemployment) and whether they were safe to use at historical decision time.`;
    try {
      const results = await recallLeakageMemories(query);
      return { ok: true as const, results: results.slice(0, 5) };
    } catch (e) {
      console.error("[hindsight] recall failed", e);
      return { ok: false as const, results: [] };
    }
  });

export const reflectOnHistory = createServerFn({ method: "POST" }).handler(async () => {
  try {
    const r = await reflectLeakageHistory(
      "Across all ChronoGuard memories, what recurring types of temporal leakage have appeared? Which kinds of new features should the team inspect before training?",
    );
    return { ok: true as const, text: r.text };
  } catch (e) {
    console.error("[hindsight] reflect failed", e);
    return { ok: false as const, text: "" };
  }
});
