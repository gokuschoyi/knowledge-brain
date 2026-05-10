from pgvector.django import VectorField
from django.db import models
from apps.core.models import Brain


class Document(models.Model):
    AUTHORITY_UNKNOWN = "unknown"
    AUTHORITY_USER = "user_provided"
    AUTHORITY_SECONDARY = "secondary"
    AUTHORITY_PRIMARY = "primary"
    AUTHORITY_CHOICES = [
        (AUTHORITY_UNKNOWN, "Unknown"),
        (AUTHORITY_USER, "User Provided"),
        (AUTHORITY_SECONDARY, "Secondary Source"),
        (AUTHORITY_PRIMARY, "Primary Source"),
    ]

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
    source_authority = models.CharField(
        max_length=50,
        choices=AUTHORITY_CHOICES,
        default=AUTHORITY_UNKNOWN,
    )
    source_published_at = models.DateTimeField(null=True, blank=True)
    source_observed_at = models.DateTimeField(null=True, blank=True)
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
    metadata = models.JSONField(default=dict, blank=True)
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


class ChunkExtractionArtifact(models.Model):
    STATUS_PENDING = "pending"
    STATUS_QUEUED = "queued"
    STATUS_RUNNING = "running"
    STATUS_COMPLETED = "completed"
    STATUS_FAILED = "failed"
    STATUS_CHOICES = [
        (STATUS_PENDING, "Pending"),
        (STATUS_QUEUED, "Queued"),
        (STATUS_RUNNING, "Running"),
        (STATUS_COMPLETED, "Completed"),
        (STATUS_FAILED, "Failed"),
    ]
    EMPTY_CHECK_NOT_NEEDED = "not_needed"
    EMPTY_CHECK_VERIFIED_EMPTY = "verified_empty"
    EMPTY_CHECK_RETRY_RECOMMENDED = "retry_recommended"
    EMPTY_CHECK_CHOICES = [
        (EMPTY_CHECK_NOT_NEEDED, "Not needed"),
        (EMPTY_CHECK_VERIFIED_EMPTY, "Verified empty"),
        (EMPTY_CHECK_RETRY_RECOMMENDED, "Retry recommended"),
    ]

    ingestion_job = models.ForeignKey(
        IngestionJob,
        on_delete=models.CASCADE,
        related_name="chunk_artifacts",
    )
    document = models.ForeignKey(
        Document,
        on_delete=models.CASCADE,
        related_name="chunk_artifacts",
    )
    chunk = models.ForeignKey(
        Chunk,
        on_delete=models.CASCADE,
        related_name="extraction_artifacts",
    )
    status = models.CharField(max_length=50, choices=STATUS_CHOICES, default=STATUS_PENDING)
    payload = models.JSONField(default=dict, blank=True)
    error_message = models.TextField(blank=True)
    empty_verification_status = models.CharField(
        max_length=50,
        choices=EMPTY_CHECK_CHOICES,
        default=EMPTY_CHECK_NOT_NEEDED,
    )
    empty_verification_message = models.TextField(blank=True)
    attempt_count = models.PositiveIntegerField(default=0)
    started_at = models.DateTimeField(null=True, blank=True)
    completed_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["chunk__chunk_index", "id"]
        unique_together = ("ingestion_job", "chunk")
