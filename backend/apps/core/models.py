from django.db import models
import uuid


class Brain(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=255)
    description = models.TextField(blank=True, null=True)
    auto_repair_enabled = models.BooleanField(default=False)
    auto_repair_safe_only = models.BooleanField(default=True)
    auto_repair_allowed_types = models.JSONField(default=list, blank=True)
    auto_repair_frequency_minutes = models.PositiveIntegerField(default=60)
    last_auto_repair_at = models.DateTimeField(null=True, blank=True)
    pending_ingestion_repair_rescan_version = models.PositiveIntegerField(default=0)
    completed_ingestion_repair_rescan_version = models.PositiveIntegerField(default=0)
    ingestion_repair_rescan_running = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return self.name
