from django.db import models

from apps.core.models import Brain
from apps.documents.models import Chunk, Document
from apps.knowledge.models import Entity


class SelfHealingTask(models.Model):
    TYPE_DUPLICATE_ENTITY = "duplicate_entity"
    TYPE_MISSING_DEFINITION = "missing_definition"
    TYPE_LOW_CONFIDENCE_ANSWER = "low_confidence_answer"
    TYPE_CONTRADICTION = "contradiction"
    TYPE_ORPHAN_CHUNK = "orphan_chunk"

    STATUS_PENDING = "pending"
    STATUS_RUNNING = "running"
    STATUS_COMPLETED = "completed"
    STATUS_FAILED = "failed"
    STATUS_IGNORED = "ignored"

    task_type = models.CharField(max_length=100)
    status = models.CharField(max_length=50, default=STATUS_PENDING)
    priority = models.IntegerField(default=1)
    title = models.CharField(max_length=255)
    description = models.TextField()
    brain = models.ForeignKey(Brain, null=True, blank=True, on_delete=models.SET_NULL, related_name="self_healing_tasks")
    related_document = models.ForeignKey(Document, null=True, blank=True, on_delete=models.SET_NULL)
    related_chunk = models.ForeignKey(Chunk, null=True, blank=True, on_delete=models.SET_NULL)
    related_entity = models.ForeignKey(Entity, null=True, blank=True, on_delete=models.SET_NULL)
    payload = models.JSONField(default=dict, blank=True)
    result = models.JSONField(default=dict, blank=True)
    error_message = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    completed_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ["status", "-priority", "-created_at"]
