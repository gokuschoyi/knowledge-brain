from django.db import models

from apps.core.models import Brain


class QueryRepairMemory(models.Model):
    STATUS_RESOLVED = "resolved"
    STATUS_UNRESOLVED = "unresolved"

    brain = models.ForeignKey(
        Brain,
        null=True,
        blank=True,
        on_delete=models.CASCADE,
        related_name="query_repair_memories",
    )
    normalized_question = models.CharField(max_length=500)
    question_examples = models.JSONField(default=list, blank=True)
    recommended_chunk_ids = models.JSONField(default=list, blank=True)
    related_entity_ids = models.JSONField(default=list, blank=True)
    knowledge_gaps = models.JSONField(default=list, blank=True)
    last_answer_confidence = models.FloatField(default=0)
    status = models.CharField(max_length=50, default=STATUS_RESOLVED)
    times_applied = models.PositiveIntegerField(default=0)
    last_repaired_at = models.DateTimeField(auto_now=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-last_repaired_at"]
        constraints = [
            models.UniqueConstraint(
                fields=["brain", "normalized_question"],
                name="retrieval_qrm_brain_question_unique",
            )
        ]
