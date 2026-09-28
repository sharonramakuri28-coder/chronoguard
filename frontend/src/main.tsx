import React, { useState } from "react";
import { createRoot } from "react-dom/client";
import {
  ShieldAlert,
  Brain,
  Search,
  Lightbulb,
  Clock3,
  CheckCircle2,
  Database,
  ArrowRight,
  RotateCcw,
} from "lucide-react";
import "./styles.css";

const API = "http://127.0.0.1:8000";

type Finding = {
  feature_name: string;
  prediction_time: string;
  available_time: string;
  delay_hours: number;
  source: string;
  status: "LEAKAGE" | "SAFE";
};

type AuditResponse = {
  audit: {
    experiment_id: string;
    findings: Finding[];
  };

  hindsight: {
    stored?: boolean;
    lesson?: string;
    experiment_id?: string;
    learned_features?: string[];
  } | null;
};

type DatasetSummary = {
  total_features: number;
  safe_features: number;
  leaked_features: number;
  leakage_rate: number;
  safe_feature_names?: string[];
  leakage_feature_names?: string[];
  leakage_features?: {
    feature_name: string;
    risk_level: string;
    explanation: string;
  }[];
};


/* ============================================================
   HINDSIGHT DISPLAY HELPERS
   ============================================================ */

function getRetainMessage(
  audit: AuditResponse | null
) {
  if (!audit?.hindsight?.stored) {
    return "No leakage experience was retained.";
  }

  return "Learned: post-event outcomes can contain information that was unavailable at prediction time.";
}


function getRecallMessage(
  recall: any
) {
  if (!recall) {
    return "Searching previous leakage experiences...";
  }

  if (
    recall.memories &&
    recall.memories.length > 0
  ) {
    return "ChronoGuard recalled a related future-outcome leakage pattern from previous audits.";
  }

  return "No similar historical leakage pattern was found.";
}


function getReflectMessage(
  reflect: any
) {
  if (!reflect) {
    return "Waiting for new evidence...";
  }

  return "Future sales outcomes and final sales aggregates can contain information that was unavailable at the original decision time.";
}


/* ============================================================
   APP
   ============================================================ */

function App() {

  const [audit, setAudit] =
    useState<AuditResponse | null>(null);

  const [dataset, setDataset] =
    useState<DatasetSummary | null>(null);

  const [recall, setRecall] =
    useState<any>(null);

  const [reflect, setReflect] =
    useState<any>(null);

  const [impact, setImpact] =
    useState<any>(null);

  const [experiments, setExperiments] =
    useState<any[]>([]);

  const [reAudit, setReAudit] =
    useState<any>(null);

  const [loading, setLoading] =
    useState(false);

  const [stage, setStage] =
    useState(0);

  const [status, setStatus] =
    useState("");


  /* ==========================================================
     STEP 1 — AUDIT + RETAIN
     ========================================================== */

  async function runAudit() {

    try {

      setLoading(true);

      setStatus(
        "Analyzing the ChronoGuard dataset..."
      );

      setAudit(null);
      setRecall(null);
      setReflect(null);
      setImpact(null);
      setExperiments([]);
      setReAudit(null);
      setDataset(null);
      setStage(0);


      /* --------------------------------------------------------
         REAL FEATURE METADATA DATASET
         -------------------------------------------------------- */

      const datasetResponse =
        await fetch(
          `${API}/analyze-real-data`
        );


      if (!datasetResponse.ok) {

        throw new Error(
          "Could not analyze real dataset."
        );

      }


      const datasetData =
        await datasetResponse.json();


      setDataset(
        datasetData.summary
      );


      /* --------------------------------------------------------
         MODEL IMPACT
         -------------------------------------------------------- */

      const impactResponse =
        await fetch(
          `${API}/api/model-impact`
        );

      if (!impactResponse.ok) {

        throw new Error(
          "Could not calculate model impact."
        );

      }

      const impactData =
        await impactResponse.json();

      setImpact(
        impactData
      );


      /* --------------------------------------------------------
         DEMO EXPERIMENT
         -------------------------------------------------------- */

      setStatus(
        "Auditing EXP-001 for prediction-time leakage..."
      );


      const expResponse =
        await fetch(
          `${API}/api/demo-experiment`
        );


      if (!expResponse.ok) {

        throw new Error(
          "Could not load demo experiment."
        );

      }


      const experiment =
        await expResponse.json();


      /* --------------------------------------------------------
         AUDIT
         -------------------------------------------------------- */

      const auditResponse =
        await fetch(
          `${API}/api/audit`,
          {
            method: "POST",

            headers: {
              "Content-Type":
                "application/json",
            },

            body:
              JSON.stringify(experiment),
          }
        );


      if (!auditResponse.ok) {

        throw new Error(
          "Temporal audit failed."
        );

      }


      const data: AuditResponse =
        await auditResponse.json();


      setAudit(data);

      setStage(1);


      setStatus(
        "Audit complete. Leakage experience retained in Hindsight."
      );

    }

    catch (error) {

      console.error(error);

      setStatus(
        error instanceof Error
          ? error.message
          : "Audit failed."
      );

    }

    finally {

      setLoading(false);

    }

  }


  /* ==========================================================
     STEP 2 — RECALL
     ========================================================== */

  async function runRecall() {

    try {

      setLoading(true);

      setStatus(
        "Hindsight is searching previous experiences..."
      );


      const query =
        "A new sales forecasting dataset contains a feature called tomorrow_sales. " +
        "It represents an actual future sales outcome that was not available at the " +
        "original decision time. Have we encountered a similar temporal leakage " +
        "pattern involving future sales, next-week sales, month-end totals, or final revenue before?";


      const response =
        await fetch(
          `${API}/api/recall?query=${encodeURIComponent(
            query
          )}`,
          {
            method: "POST",
          }
        );


      if (!response.ok) {

        throw new Error(
          "Hindsight recall failed."
        );

      }


      const data =
        await response.json();


      setRecall(data);

      setStage(2);


      setStatus(
        "Previous leakage experience recalled."
      );

    }

    catch (error) {

      console.error(error);

      setStatus(
        error instanceof Error
          ? error.message
          : "Recall failed."
      );

    }

    finally {

      setLoading(false);

    }

  }


  /* ==========================================================
     STEP 3 — REFLECT
     ========================================================== */

  async function runReflect() {

    try {

      setLoading(true);

      setStatus(
        "Hindsight is reflecting on the new rule..."
      );


      const query =
        "A new audit rule says that future sales outcomes and final sales aggregates " +
        "may become available only after the original decision time. Based on everything " +
        "ChronoGuard has learned about temporal leakage, what should be reconsidered " +
        "in previous sales forecasting experiments and what new rule should ChronoGuard remember?";


      const response =
        await fetch(
          `${API}/api/reflect?query=${encodeURIComponent(
            query
          )}`,
          {
            method: "POST",
          }
        );


      if (!response.ok) {

        throw new Error(
          "Hindsight reflection failed."
        );

      }


      const data =
        await response.json();


      setReflect(data);

      setStage(3);

      setStatus(
        "New knowledge synthesized. Checking historical experiments..."
      );


      /* ========================================================
         AUTOMATIC HISTORICAL RE-AUDIT
         ======================================================== */

      const experimentsResponse =
        await fetch(
          `${API}/api/experiments`
        );


      if (!experimentsResponse.ok) {

        throw new Error(
          "Could not load historical experiments."
        );

      }


      const experimentsData =
        await experimentsResponse.json();


      setExperiments(
        experimentsData.experiments ?? []
      );


      /* ========================================================
         APPLY HINDSIGHT KNOWLEDGE TO HISTORY
         ======================================================== */

      const reAuditResponse =
        await fetch(
          `${API}/api/knowledge/re-audit`,
          {
            method: "POST",
          }
        );


      if (!reAuditResponse.ok) {

        throw new Error(
          "Historical re-audit failed."
        );

      }


      const reAuditData =
        await reAuditResponse.json();


      setReAudit(
        reAuditData
      );


      setStage(4);

      setStatus(
        "Hindsight knowledge identified historical experiments that require re-audit."
      );

    }

    catch (error) {

      console.error(error);

      setStatus(
        error instanceof Error
          ? error.message
          : "Reflection failed."
      );

    }

    finally {

      setLoading(false);

    }

  }


  /* ==========================================================
     RESET
     ========================================================== */

  function resetDemo() {

    setAudit(null);

    setDataset(null);

    setImpact(null);

    setExperiments([]);

    setReAudit(null);

    setRecall(null);

    setReflect(null);

    setStage(0);

    setStatus("");

  }


  /* ==========================================================
     CALCULATIONS
     ========================================================== */

  const findings =
    audit?.audit?.findings ?? [];


  const leakedFeatures =
    findings.filter(
      (item) =>
        item.status === "LEAKAGE"
    );


  const safeFeatures =
    findings.filter(
      (item) =>
        item.status === "SAFE"
    );


  const memories =
    recall?.memories ?? [];


  /* ==========================================================
     UI
     ========================================================== */

  return (

    <div className="app">


      {/* ======================================================
          HEADER
          ====================================================== */}

      <header>

        <div className="brand">

          <div className="logo">
            <Clock3 />
          </div>

          <div>

            <h1>
              ChronoGuard
            </h1>

            <p>
              Know What Was Knowable
            </p>

          </div>

        </div>


        <div className="badge">
          V2 · Temporal Intelligence
        </div>

      </header>


      <main>


        {/* ====================================================
            HERO
            ==================================================== */}

        <section className="hero">

          <span className="eyebrow">
            AI AGENT FOR ML EXPERIMENT AUDITING
          </span>


          <h2>

            Stop your model from{" "}

            <span>
              learning from tomorrow.
            </span>

          </h2>


          <p>

            ChronoGuard reconstructs what information
            was available at prediction time, detects
            temporal leakage, and learns leakage patterns
            for future experiments.

          </p>


          {!audit ? (

            <button
              className="run-button"
              onClick={runAudit}
              disabled={loading}
            >

              {loading
                ? "Analyzing..."
                : "① Run Temporal Audit →"}

            </button>

          ) : (

            <button
              className="reset-button"
              onClick={resetDemo}
            >

              <RotateCcw size={15} />

              Reset Demo

            </button>

          )}


          {status && (

            <div className="status-message">

              <span className="status-dot" />

              {status}

            </div>

          )}

        </section>


        {/* ====================================================
            LEARNING PROGRESS
            ==================================================== */}

        {audit && (

          <section className="learning-progress">


            {/* RETAIN */}

            <div className="progress-step active">

              <div className="progress-number">

                <CheckCircle2 size={18} />

              </div>


              <div>

                <small>
                  STEP 01
                </small>

                <strong>
                  RETAIN
                </strong>

                <span>
                  Learn from audit
                </span>

              </div>

            </div>


            <ArrowRight
              className="progress-arrow"
            />


            {/* RECALL */}

            <div
              className={
                stage >= 2
                  ? "progress-step active"
                  : "progress-step"
              }
            >

              <div className="progress-number">

                {stage >= 2
                  ? <CheckCircle2 size={18} />
                  : "2"}

              </div>


              <div>

                <small>
                  STEP 02
                </small>

                <strong>
                  RECALL
                </strong>

                <span>
                  Remember patterns
                </span>

              </div>

            </div>


            <ArrowRight
              className="progress-arrow"
            />


            {/* REFLECT */}

            <div
              className={
                stage >= 3
                  ? "progress-step active"
                  : "progress-step"
              }
            >

              <div className="progress-number">

                {stage >= 3
                  ? <CheckCircle2 size={18} />
                  : "3"}

              </div>


              <div>

                <small>
                  STEP 03
                </small>

                <strong>
                  REFLECT
                </strong>

                <span>
                  Learn new rules
                </span>

              </div>

            </div>

          </section>

        )}


        {/* ====================================================
            REAL DATASET OVERVIEW
            ==================================================== */}

        {dataset && (

          <section className="dataset-section">


            <div className="section-label">

              <Database size={16} />

              REAL DATASET OVERVIEW

            </div>


            <div className="dataset-header">


              <div>

                <h3>
                  {dataset.total_features} Sales Forecasting Features
                </h3>

                <p>
                  ChronoGuard checked whether each feature was available
                  at the original decision time.
                </p>

              </div>


              <div className="leakage-rate">

                <strong>
                  {dataset.leakage_rate}%
                </strong>

                <span>
                  TEMPORAL LEAKAGE
                </span>

              </div>

            </div>


            <div className="dataset-metrics">


              <div className="dataset-metric">

                <small>
                  TOTAL FEATURES
                </small>

                <strong>
                  {dataset.total_features}
                </strong>

              </div>


              <div className="dataset-metric safe">

                <small>
                  SAFE
                </small>

                <strong>
                  {dataset.safe_features}
                </strong>

              </div>


              <div className="dataset-metric danger">

                <small>
                  LEAKED
                </small>

                <strong>
                  {dataset.leaked_features}
                </strong>

              </div>


            </div>

          </section>

        )}


        {/* ====================================================
            CURRENT EXPERIMENT
            ==================================================== */}

        {audit && (

          <>


            <section className="experiment-header">


              <div>

                <div className="section-label">

                  <ShieldAlert size={16} />

                  CURRENT EXPERIMENT

                </div>


                <h3>
                  {audit.audit.experiment_id}
                </h3>


                <p>
                  Deep-dive temporal audit of the
                  current sales forecasting experiment.
                </p>

              </div>


              <div className="experiment-result">

                <strong>
                  {leakedFeatures.length}
                </strong>

                <span>
                  LEAKED FEATURES
                </span>

              </div>


            </section>


            {/* ==================================================
                FINDINGS
                ================================================== */}

            <section className="panel">


              <div className="panel-title">

                <ShieldAlert />

                <div>

                  <strong>
                    Temporal Leakage Findings
                  </strong>

                  <span>
                    What was unknowable at prediction time?
                  </span>

                </div>

              </div>


              {findings.map(
                (finding) => (

                  <div
                    className={
                      finding.status === "SAFE"
                        ? "finding finding-safe"
                        : "finding"
                    }

                    key={
                      finding.feature_name
                    }
                  >


                    <div className="finding-main">


                      <div className="finding-name">


                        {finding.status ===
                        "LEAKAGE" ? (

                          <ShieldAlert
                            size={16}
                          />

                        ) : (

                          <CheckCircle2
                            size={16}
                          />

                        )}


                        <b>
                          {finding.feature_name}
                        </b>


                      </div>


                      <p>

                        {finding.status ===
                        "LEAKAGE"

                          ? `Available ${finding.delay_hours} hours after prediction time.`

                          : "Available at or before prediction time."}

                      </p>


                      <div className="finding-meta">

                        Source:
                        {" "}
                        {finding.source}

                      </div>


                    </div>


                    <span
                      className={
                        finding.status ===
                        "LEAKAGE"

                          ? "status-leakage"

                          : "status-safe"
                      }
                    >

                      {finding.status}

                    </span>


                  </div>

                )
              )}

            </section>


            {/* ==================================================
                TEMPORAL IMPACT
                ================================================== */}

            {dataset && (

              <section className="impact-section">

                <div className="section-label">

                  <ShieldAlert size={16} />

                  TEMPORAL IMPACT

                </div>

                <div className="impact-heading">

                  <div>

                    <h3>
                      What did ChronoGuard actually discover?
                    </h3>

                    <p>
                      The audit evaluates feature availability at
                      the original decision time.
                    </p>

                  </div>

                  <div className="impact-gap">

                    <strong>
                      {dataset.leakage_rate}%
                    </strong>

                    <span>
                      FEATURES AT RISK
                    </span>

                  </div>

                </div>

                <div className="impact-grid">

                  <div className="impact-card before">

                    <span className="impact-label">
                      FEATURES CHECKED
                    </span>

                    <strong>
                      {dataset.total_features}
                    </strong>

                    <div className="impact-status danger">
                      TEMPORAL AVAILABILITY AUDIT
                    </div>

                    <p>
                      ChronoGuard checks whether each feature
                      was available when the original decision
                      was made.
                    </p>

                  </div>

                  <div className="impact-arrow">
                    →
                  </div>

                  <div className="impact-card after">

                    <span className="impact-label">
                      POTENTIAL LEAKAGE
                    </span>

                    <strong>
                      {dataset.leaked_features}
                    </strong>

                    <div className="impact-status safe">
                      {dataset.leakage_rate}% OF FEATURES
                    </div>

                    <p>
                      These features should not be treated as
                      prediction-time inputs unless their actual
                      availability is proven.
                    </p>

                  </div>

                </div>

                <div className="impact-note">

                  <ShieldAlert size={14} />

                  <span>
                    This dataset contains feature-availability
                    metadata, not model predictions and ground-truth
                    labels. ChronoGuard therefore reports leakage
                    risk rather than claiming a measured accuracy
                    change.
                  </span>

                </div>

              </section>

            )}

            {/* ==================================================
                RETAIN
                ================================================== */}

            <section className="memory-section">


              <div className="section-label">

                <Brain size={16} />

                HINDSIGHT · STEP 01

              </div>


              <div className="step-heading">


                <div className="step-icon retain-icon">

                  <Brain />

                </div>


                <div>

                  <h3>
                    ChronoGuard learned from this audit.
                  </h3>

                  <p>
                    The leakage experience has been
                    retained as organizational memory.
                  </p>

                </div>


              </div>


              {/* SHORT RETAIN MEMORY */}

              <div className="lesson-box">

                <small>
                  RETAINED EXPERIENCE
                </small>


                <p className="short-memory">

                  {getRetainMessage(
                    audit
                  )}

                </p>


                {audit.hindsight?.learned_features &&
                  audit.hindsight.learned_features.length >
                    0 && (

                    <div className="memory-tags">

                      {audit.hindsight.learned_features.map(
                        (feature) => (

                          <span
                            key={feature}
                          >
                            {feature}
                          </span>

                        )
                      )}

                    </div>

                  )}

              </div>


              {/* RECALL BUTTON */}

              {stage === 1 && (

                <button
                  className="next-button"
                  onClick={runRecall}
                  disabled={loading}
                >

                  {loading
                    ? "Searching memory..."
                    : "② Test New Dataset →"}

                </button>

              )}

            </section>


            {/* ==================================================
                RECALL
                ================================================== */}

            {stage >= 2 && (

              <section className="memory-section recall-section">


                <div className="section-label">

                  <Search size={16} />

                  HINDSIGHT · STEP 02

                </div>


                <div className="step-heading">


                  <div className="step-icon recall-icon">

                    <Search />

                  </div>


                  <div>

                    <h3>
                      ChronoGuard remembered
                      a similar pattern.
                    </h3>

                    <p>

                      New feature detected:

                      <strong>
                        {" "}
                        tomorrow_sales
                      </strong>

                    </p>

                  </div>


                </div>


                {/* NEW FEATURE */}

                <div className="new-feature">


                  <div>

                    <span>
                      NEW DATASET FEATURE
                    </span>

                    <strong>
                      tomorrow_sales
                    </strong>

                  </div>


                  <div className="warning-pill">

                    POTENTIAL LEAKAGE

                  </div>


                </div>


                {/* SHORT RECALL MEMORY */}

                <div className="recall-box">


                  <small>
                    RELEVANT MEMORY
                  </small>


                  <p className="short-memory">

                    {getRecallMessage(
                      recall
                    )}

                  </p>


                  {memories.length > 0 && (

                    <div className="memory-match">

                      <Search size={14} />

                      <span>

                        {memories.length}
                        {" "}
                        related experience
                        {memories.length === 1
                          ? ""
                          : "s"} recalled

                      </span>

                    </div>

                  )}

                </div>


                {/* REFLECT BUTTON */}

                {stage === 2 && (

                  <button
                    className="next-button reflect-button"
                    onClick={runReflect}
                    disabled={loading}
                  >

                    {loading
                      ? "Reflecting..."
                      : "③ Apply New Rule →"}

                  </button>

                )}

              </section>

            )}


            {/* ==================================================
                REFLECT
                ================================================== */}

            {stage >= 3 && (

              <section className="memory-section reflect-section">


                <div className="section-label">

                  <Lightbulb size={16} />

                  HINDSIGHT · STEP 03

                </div>


                <div className="step-heading">


                  <div className="step-icon reflect-icon">

                    <Lightbulb />

                  </div>


                  <div>

                    <h3>
                      ChronoGuard learned a new rule.
                    </h3>

                    <p>
                      New evidence changes how previous
                      experiments should be interpreted.
                    </p>

                  </div>


                </div>


                {/* NEW RULE */}

                <div className="rule-box">


                  <div className="rule-feature">

                    FUTURE SALES DATA

                  </div>


                  <div className="rule-arrow">

                    →

                  </div>


                  <div className="rule-delay">

                    AFTER DECISION

                  </div>


                  <div className="rule-result">

                    FUTURE INFORMATION

                  </div>


                </div>


                {/* SHORT REFLECTION */}

                <div className="reflect-box">


                  <small>
                    HINDSIGHT REFLECTION
                  </small>


                  <p className="short-memory">

                    {getReflectMessage(
                      reflect
                    )}

                  </p>


                </div>


                {/* FINAL LEARNING */}

                <div className="final-learning">


                  <div className="final-title">

                    <Brain size={18} />

                    CHRONOGUARD LEARNING COMPLETE

                  </div>


                  <div className="final-flow">


                    <span>
                      RETAIN ✓
                    </span>


                    <ArrowRight />


                    <span>
                      RECALL ✓
                    </span>


                    <ArrowRight />


                    <span>
                      REFLECT ✓
                    </span>


                  </div>


                  <p>

                    ChronoGuard can now carry
                    this leakage experience into
                    future sales forecasting audits.

                  </p>


                </div>


              </section>

            )}


            {/* ==================================================
                HISTORICAL RE-AUDIT
                ================================================== */}

            {stage >= 4 && (

              <section className="memory-section" style={{
                borderColor: "rgba(99, 102, 241, 0.45)"
              }}>

                <div className="section-label">
                  <Database size={16} />
                  KNOWLEDGE → HISTORICAL RE-AUDIT
                </div>

                <div className="step-heading">
                  <div className="step-icon recall-icon">
                    <Database />
                  </div>

                  <div>
                    <h3>
                      New knowledge changed the historical audit.
                    </h3>
                    <p>
                      Hindsight applied the learned leakage patterns
                      to previously recorded experiments.
                    </p>
                  </div>
                </div>

                                {reAudit && (
                  <>
                    <div className="lesson-box" style={{ marginTop: "18px" }}>
                      <small>HINDSIGHT KNOWLEDGE APPLIED</small>
                      <p className="short-memory">
                        {reAudit.knowledge_update}
                      </p>
                      <div className="memory-tags">
                        <span>{reAudit.leaked_feature_count} known leakage features</span>
                        <span>{reAudit.affected_experiment_count} experiments require review</span>
                      </div>
                    </div>

                    <div style={{ marginTop: "16px" }}>
                      {(reAudit.affected_experiments ?? []).map((item: any) => (
                        <div
                          key={`${item.experiment_id}-${item.feature_name}`}
                          className="finding"
                        >
                          <div className="finding-main">
                            <div className="finding-name">
                              <ShieldAlert size={16} />
                              <b>{item.experiment_id} · {item.model_name}</b>
                            </div>
                            <p>
                              {item.feature_name} · Decision date: {item.decision_date}
                            </p>
                            <div className="finding-meta">
                              {item.reason}
                            </div>
                          </div>
                          <span className="status-leakage">
                            RE-AUDIT REQUIRED
                          </span>
                        </div>
                      ))}
                    </div>

                    <div className="final-learning" style={{ marginTop: "18px" }}>
                      <div className="final-title">
                        <Brain size={18} />
                        NEW KNOWLEDGE AFFECTED OLD EXPERIMENTS
                      </div>
                      <p>
                        Postgres-style experiment history stores what happened.
                        Hindsight stores what the team learned about why it matters.
                        ChronoGuard uses that knowledge to decide which historical
                        experiments need another look.
                      </p>
                    </div>
                  </>
                )}

              </section>

            )}


            {/* ==================================================
                FINAL PRINCIPLE
                ================================================== */}

            {stage >= 4 && (

              <section className="closing">


                <div className="closing-icon">

                  <Clock3 />

                </div>


                <div>


                  <span>
                    THE CHRONOGUARD PRINCIPLE
                  </span>


                  <h3>

                    A model should only know
                    what the real world knew.

                  </h3>


                  <p>

                    Detect the future.
                    Remember the lesson.
                    Apply it to the next experiment.

                  </p>


                </div>


              </section>

            )}

          </>

        )}

      </main>

    </div>

  );

}


/* ============================================================
   RENDER
   ============================================================ */

createRoot(
  document.getElementById("root")!
).render(
  <App />
);