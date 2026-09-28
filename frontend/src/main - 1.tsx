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
  total_rows: number;
  safe_rows: number;
  leaked_rows: number;
  leakage_rate: number;
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
    return "cb_resolution matches a previous chargeback leakage pattern.";
  }

  return "No similar historical leakage pattern was found.";
}


function getReflectMessage(
  reflect: any
) {
  if (!reflect) {
    return "Waiting for new evidence...";
  }

  return "claim_final_status arrives 5 days later → affected experiments should be rechecked.";
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
      setDataset(null);
      setStage(0);


      /* --------------------------------------------------------
         REAL 2,000 ROW DATASET
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
        "A new fraud prediction dataset contains a feature called cb_resolution. " +
        "It represents the final resolution of a chargeback and becomes available " +
        "several days after the original transaction prediction. " +
        "Have we encountered a similar temporal leakage pattern before?";


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
        "A new audit rule says that claim_final_status is only available " +
        "5 days after the original prediction time. Based on everything " +
        "ChronoGuard has learned about temporal leakage, what should we " +
        "change in our previous experiments and what new rule should " +
        "ChronoGuard remember?";


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
        "New knowledge synthesized successfully."
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
                  2,000 Financial Experiment Records
                </h3>

                <p>
                  ChronoGuard scanned historical feature
                  availability against prediction time.
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
                  TOTAL RECORDS
                </small>

                <strong>
                  {dataset.total_rows.toLocaleString()}
                </strong>

              </div>


              <div className="dataset-metric safe">

                <small>
                  SAFE
                </small>

                <strong>
                  {dataset.safe_rows.toLocaleString()}
                </strong>

              </div>


              <div className="dataset-metric danger">

                <small>
                  LEAKED
                </small>

                <strong>
                  {dataset.leaked_rows.toLocaleString()}
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
                  current fraud prediction experiment.
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
                MODEL IMPACT
                ================================================== */}

            {impact && (

              <section className="impact-section">

                <div className="section-label">

                  <ShieldAlert size={16} />

                  MODEL IMPACT

                </div>


                <div className="impact-heading">

                  <div>

                    <h3>
                      What did the leakage actually change?
                    </h3>

                    <p>
                      Compare the reported backtest with the
                      corrected temporal scenario.
                    </p>

                  </div>


                  <div className="impact-gap">

                    <strong>
                      +{impact.performance_gap}
                    </strong>

                    <span>
                      POINT GAP
                    </span>

                  </div>

                </div>


                <div className="impact-grid">


                  {/* BEFORE */}

                  <div className="impact-card before">

                    <span className="impact-label">
                      BEFORE TEMPORAL AUDIT
                    </span>


                    <strong>
                      {impact.before_accuracy}%
                    </strong>


                    <div className="impact-status danger">
                      ⚠ INVALID IF LEAKAGE IS PRESENT
                    </div>


                    <p>
                      Reported model performance can be
                      overstated when future information
                      enters the feature set.
                    </p>

                  </div>


                  {/* ARROW */}

                  <div className="impact-arrow">

                    →

                  </div>


                  {/* AFTER */}

                  <div className="impact-card after">

                    <span className="impact-label">
                      AFTER TEMPORAL AUDIT
                    </span>


                    <strong>
                      {impact.after_accuracy}%
                    </strong>


                    <div className="impact-status safe">
                      ✓ CORRECTED SCENARIO
                    </div>


                    <p>
                      Future information is removed from
                      the prediction-time feature set.
                    </p>

                  </div>

                </div>


                <div className="impact-note">

                  <ShieldAlert size={14} />

                  <span>
                    Illustrative demo backtest: the current
                    dataset does not contain model predictions
                    and ground-truth labels, so the corrected
                    accuracy is not statistically calculated
                    from this CSV.
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
                        cb_resolution
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
                      cb_resolution
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

                    claim_final_status

                  </div>


                  <div className="rule-arrow">

                    →

                  </div>


                  <div className="rule-delay">

                    +5 DAYS

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
                    future experiment audits.

                  </p>


                </div>


              </section>

            )}


            {/* ==================================================
                FINAL PRINCIPLE
                ================================================== */}

            {stage >= 3 && (

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