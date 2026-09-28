import os

from hindsight_client import Hindsight


class ChronoGuardMemory:

    def __init__(self):

        self.bank_id = os.getenv(
            "HINDSIGHT_BANK_ID",
            "chronoguard-demo"
        )

        self.client = Hindsight(
            base_url=os.getenv("HINDSIGHT_BASE_URL"),
            api_key=os.getenv("HINDSIGHT_API_KEY")
        )

    # ========================================================
    # RETAIN
    # ========================================================

    def retain(self, experience):

        return self.client.retain(
            bank_id=self.bank_id,
            content=experience
        )

    # ========================================================
    # RETAIN TEMPORAL LEAKAGE EXPERIENCE
    # ========================================================

    def retain_leakage_experience(self, audit_result):

        findings = audit_result.get("findings", [])

        leakage_findings = [
            finding
            for finding in findings
            if finding.get("status") == "LEAKAGE"
        ]

        if not leakage_findings:
            return {
                "stored": False,
                "reason": "No leakage findings detected."
            }

        # ----------------------------------------------------
        # Extract leaked feature information
        # ----------------------------------------------------

        feature_names = [
            finding.get("feature_name", "UNKNOWN")
            for finding in leakage_findings
        ]

        risk_levels = [
            finding.get("risk_level", "UNKNOWN")
            for finding in leakage_findings
        ]

        explanations = [
            finding.get("explanation", "")
            for finding in leakage_findings
        ]

        # Remove duplicate values while preserving order
        feature_names = list(dict.fromkeys(feature_names))
        risk_levels = list(dict.fromkeys(risk_levels))
        explanations = list(dict.fromkeys(explanations))

        # ----------------------------------------------------
        # Create a domain-neutral ChronoGuard lesson
        # ----------------------------------------------------

        lesson = (
            "ChronoGuard discovered temporal data leakage during "
            "a historical forecasting audit. "

            f"Leaked features: {', '.join(feature_names)}. "

            f"Risk levels observed: {', '.join(risk_levels)}. "

            "These features were unavailable at the original "
            "decision time and therefore may contain information "
            "that became knowable only later. "

            f"Observed explanations: {' | '.join(explanations)}. "

            "Important ChronoGuard lesson: historical machine "
            "learning and forecasting evaluations should use only "
            "information that was actually available at the "
            "original decision time. "

            "Revised, finalized, post-event, or later-published "
            "information should be checked against its actual "
            "publication or availability time before being used "
            "as a historical prediction feature. "

            "Future datasets should be checked for semantically "
            "similar features that may represent revised values, "
            "final outcomes, post-event summaries, or information "
            "published after the original decision."
        )

        # ----------------------------------------------------
        # Store experience in Hindsight
        # ----------------------------------------------------

        result = self.client.retain(
            bank_id=self.bank_id,
            content=lesson,
            context="ChronoGuard temporal leakage audit"
        )

        return {
            "stored": True,

            "experiment_id": audit_result.get(
                "experiment_id",
                "UNKNOWN"
            ),

            "learned_features": feature_names,

            "risk_levels": risk_levels,

            "lesson": lesson,

            "hindsight_result": result
        }

    # ========================================================
    # RECALL
    # ========================================================

    def recall(self, query):

        result = self.client.recall(
            bank_id=self.bank_id,
            query=query
        )

        memories = []

        for memory in result.results:

            memories.append({
                "text": memory.text,
                "type": memory.type
            })

        return {
            "query": query,
            "count": len(memories),
            "memories": memories
        }

    # ========================================================
    # RECALL SIMILAR LEAKAGE PATTERNS
    # ========================================================

    def recall_similar_patterns(self, query):

        return self.recall(query)

    # ========================================================
    # REFLECT
    # ========================================================

    def reflect(self, query):

        result = self.client.reflect(
            bank_id=self.bank_id,
            query=query
        )

        return {
            "query": query,
            "answer": result.text
        }

    # ========================================================
    # REFLECT ON NEW RULE
    # ========================================================

    def reflect_on_new_rule(self, query):

        return self.reflect(query)

    # ========================================================
    # CLOSE
    # ========================================================

    def close(self):

        self.client.close()