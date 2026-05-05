from pgvector.django import VectorField
from django.db import models
from apps.core.models import Brain


class Document(models.Model):
    STATUS_PENDING = "pending"
    STATUS_PROCESSING = "processing"
    STATUS_COMPLETED = "completed"
    STATUS_FAILED = "failed"
    STATUS_CHOICES = [
        (STATUS_PENDING, "Pending"),
        (STATUS_PROCESSING, "Processing"),
        (STATUS_COMPLETED, "Completed"),
        (STATUS_FAILED, "Failed"),
    ]

    SOURCE_TEXT = "text"
    SOURCE_FILE = "file"
    SOURCE_URL = "url"
    SOURCE_CHOICES = [
        (SOURCE_TEXT, "Text"),
        (SOURCE_FILE, "File"),
        (SOURCE_URL, "URL"),
    ]

    brain = models.ForeignKey(Brain, on_delete=models.CASCADE, related_name="documents", null=True)
    title = models.CharField(max_length=255)
    source_type = models.CharField(max_length=50, choices=SOURCE_CHOICES)
    raw_text = models.TextField(blank=True)
    raw_file = models.FileField(upload_to="documents/", null=True, blank=True)
    url = models.URLField(blank=True)
    tags = models.JSONField(default=list, blank=True)
    llm_provider = models.CharField(max_length=50, blank=True, default="")
    llm_model = models.CharField(max_length=100, blank=True, default="")
    status = models.CharField(max_length=50, choices=STATUS_CHOICES, default=STATUS_PENDING)
    summary = models.TextField(blank=True)
    quality_score = models.FloatField(default=0)
    error_message = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]


class IngestionJob(models.Model):
    STATUS_PENDING = "pending"
    STATUS_PROCESSING = "processing"
    STATUS_COMPLETED = "completed"
    STATUS_FAILED = "failed"

    document = models.ForeignKey(Document, on_delete=models.CASCADE, related_name="ingestion_jobs")
    status = models.CharField(max_length=50, default=STATUS_PENDING)
    current_step = models.CharField(max_length=100, blank=True)
    progress = models.IntegerField(default=0)
    log = models.JSONField(default=list, blank=True)
    error_message = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]


class Chunk(models.Model):
    document = models.ForeignKey(Document, on_delete=models.CASCADE, related_name="chunks")
    text = models.TextField()
    summary = models.TextField(blank=True)
    chunk_index = models.IntegerField()
    token_count = models.IntegerField(default=0)
    embedding = VectorField(dimensions=1536, null=True, blank=True)
    importance_score = models.FloatField(default=0)
    quality_score = models.FloatField(default=0)
    metadata = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["document_id", "chunk_index"]
        unique_together = ("document", "chunk_index")
