import { queryOptions } from "@tanstack/react-query";
import {
  listExperiments,
  getExperiment,
  getOverview,
  listMemories,
  listPatterns,
  listFeatureConcepts,
  listIncidents,
  getAuditRun,
  getReplayResult,
  listDatasetScans,
  listReauditEvents,
} from "./chrono.functions";

export const overviewQuery = queryOptions({
  queryKey: ["overview"],
  queryFn: () => getOverview(),
});

export const experimentsQuery = queryOptions({
  queryKey: ["experiments"],
  queryFn: () => listExperiments(),
});

export const experimentQuery = (slug: string) =>
  queryOptions({
    queryKey: ["experiment", slug],
    queryFn: () => getExperiment({ data: { slug } }),
  });

export const memoriesQuery = queryOptions({
  queryKey: ["memories"],
  queryFn: () => listMemories(),
});

export const patternsQuery = queryOptions({
  queryKey: ["patterns"],
  queryFn: () => listPatterns(),
});

export const conceptsQuery = queryOptions({
  queryKey: ["concepts"],
  queryFn: () => listFeatureConcepts(),
});

export const incidentsQuery = queryOptions({
  queryKey: ["incidents"],
  queryFn: () => listIncidents(),
});

export const auditRunQuery = (slug: string) =>
  queryOptions({
    queryKey: ["audit-run", slug],
    queryFn: () => getAuditRun({ data: { slug } }),
  });

export const replayQuery = (slug: string) =>
  queryOptions({
    queryKey: ["replay", slug],
    queryFn: () => getReplayResult({ data: { slug } }),
  });

export const datasetScansQuery = queryOptions({
  queryKey: ["dataset-scans"],
  queryFn: () => listDatasetScans(),
});

export const reauditEventsQuery = queryOptions({
  queryKey: ["reaudit-events"],
  queryFn: () => listReauditEvents(),
});

import { getHindsightStatus } from "./hindsight.functions";
export const hindsightStatusQuery = queryOptions({
  queryKey: ["hindsight-status"],
  queryFn: () => getHindsightStatus(),
  staleTime: 60_000,
});
