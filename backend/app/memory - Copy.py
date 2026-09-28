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
    # RETAIN LEAKAGE EXPERIENCE
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

        feature_names = [
            finding.get("feature_name")
            for finding in leakage_findings
        ]

        lesson = (
            "ChronoGuard discovered temporal data leakage during "
            "a financial fraud prediction audit. "
            f"Experiment: {audit_result.get('experiment_id', 'UNKNOWN')}. "
            f"Leaked features: {', '.join(feature_names)}. "
            "These features became available after prediction time "
            "and therefore contained information that was not knowable "
            "at decision time. "
            "Post-event financial outcomes should not be used as "
            "prediction-time features. "
            "Future datasets should also be checked for semantically "
            "similar feature names representing chargeback resolution, "
            "settlement, claims, or other post-event outcomes."
        )

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