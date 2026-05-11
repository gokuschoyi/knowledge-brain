from pathlib import Path

from django.db.models import Count
from rest_framework import serializers

from apps.core.llm_catalog import DEFAULT_MODEL, DEFAULT_PROVIDER, MODEL_CATALOG
from apps.documents.models import Chunk, ChunkExtractionArtifact, Document, IngestionJob
from apps.documents.services.ingestion_progress import STAGE_DEFINITIONS, ensure_stage_metadata
from apps.knowledge.models import Entity, Relationship

_ALLOWED_FILE_EXTENSIONS = {".pdf", ".txt", ".md", ".docx", ".xlsx", ".csv", ".pptx"}


class DocumentIngestSerializer(serializers.ModelSerializer):
    batch_token = serializers.CharField(required=False, allow_blank=True, write_only=True)

    class Meta:
        model = Document
        fields = [
            "brain",
            "title",
            "source_type",
            "raw_text",
            "raw_file",
            "url",
            "source_authority",
            "source_published_at",
            "source_observed_at",
            "tags",
            "llm_provider",
            "llm_model",
            "batch_token",
        ]

    def create(self, validated_data):
        validated_data.pop("batch_token", None)
        return super().create(validated_data)

    def validate_raw_file(self, value):
        suffix = Path(value.name).suffix.lower()
        if suffix not in _ALLOWED_FILE_EXTENSIONS:
            raise serializers.ValidationError(
                f"Unsupported file type '{suffix}'. " f"Allowed: {', '.join(sorted(_ALLOWED_FILE_EXTENSIONS))}"
            )
        return value

    def validate(self, attrs):
        source_type = attrs.get("source_type")
        provider = attrs.get("llm_provider") or DEFAULT_PROVIDER
        model_name = attrs.get("llm_model") or DEFAULT_MODEL
        if source_type == Document.SOURCE_TEXT and not attrs.get("raw_text"):
            raise serializers.ValidationError("raw_text is required for text sources.")
        if source_type == Document.SOURCE_FILE and not attrs.get("raw_file"):
            raise serializers.ValidationError("raw_file is required for file sources.")
        if source_type == Document.SOURCE_URL and not attrs.get("url"):
            raise serializers.ValidationError("url is required for URL sources.")
        provider_info = MODEL_CATALOG.get(provider)
        if provider_info is None:
            raise serializers.ValidationError("Unsupported LLM provider.")
        supported_models = {item["id"] for item in provider_info["models"]}
        if model_name not in supported_models:
            raise serializers.ValidationError("Unsupported LLM model for the selected provider.")
        attrs["llm_provider"] = provider
        attrs["llm_model"] = model_name
        return attrs


class ChunkSerializer(serializers.ModelSerializer):
    extraction_status = serializers.SerializerMethodField()
    entity_count = serializers.SerializerMethodField()
    relationship_count = serializers.SerializerMethodField()
    claim_count = serializers.SerializerMethodField()
    verified_empty = serializers.SerializerMethodField()
    verification_message = serializers.SerializerMethodField()

    class Meta:
        model = Chunk
        fields = [
            "id",
            "document",
            "text",
            "summary",
            "chunk_index",
            "token_count",
            "importance_score",
            "quality_score",
            "metadata",
            "extraction_status",
            "entity_count",
            "relationship_count",
            "claim_count",
            "verified_empty",
            "verification_message",
        ]

    def get_extraction_status(self, obj):
        artifact = obj.extraction_artifacts.order_by("-id").first()
        return artifact.status if artifact else "pending"

    def get_entity_count(self, obj):
        return obj.entity_mentions.count()

    def get_relationship_count(self, obj):
        return obj.relationships.count()

    def get_claim_count(self, obj):
        return obj.claims.count()

    def get_verified_empty(self, obj):
        artifact = obj.extraction_artifacts.order_by("-id").first()
        return bool(
            artifact and artifact.empty_verification_status == ChunkExtractionArtifact.EMPTY_CHECK_VERIFIED_EMPTY
        )

    def get_verification_message(self, obj):
        artifact = obj.extraction_artifacts.order_by("-id").first()
        return artifact.empty_verification_message if artifact else ""


class DocumentSerializer(serializers.ModelSerializer):
    chunks_count = serializers.IntegerField(source="chunks.count", read_only=True)
    source_label = serializers.CharField(source="get_source_type_display", read_only=True)
    status_label = serializers.CharField(source="get_status_display", read_only=True)
    source_authority_label = serializers.CharField(
        source="get_source_authority_display",
        read_only=True,
    )
    brain_name = serializers.CharField(source="brain.name", read_only=True)
    latest_job_status = serializers.SerializerMethodField()
    latest_activity_at = serializers.DateTimeField(source="updated_at", read_only=True)

    class Meta:
        model = Document
        fields = [
            "id",
            "title",
            "source_type",
            "source_label",
            "source_authority",
            "source_authority_label",
            "source_published_at",
            "source_observed_at",
            "tags",
            "llm_provider",
            "llm_model",
            "summary",
            "status",
            "status_label",
            "quality_score",
            "error_message",
            "created_at",
            "updated_at",
            "latest_activity_at",
            "chunks_count",
            "brain_name",
            "latest_job_status",
        ]

    def get_latest_job_status(self, obj):
        latest_job = obj.ingestion_jobs.order_by("-created_at").first()
        return latest_job.status if latest_job else None


class IngestionJobSerializer(serializers.ModelSerializer):
    stages = serializers.SerializerMethodField()
    chunk_progress = serializers.SerializerMethodField()
    chunk_details = serializers.SerializerMethodField()
    document_title = serializers.CharField(source="document.title", read_only=True)

    class Meta:
        model = IngestionJob
        fields = [
            "id",
            "document",
            "document_title",
            "status",
            "current_step",
            "progress",
            "log",
            "metadata",
            "error_message",
            "created_at",
            "updated_at",
            "stages",
            "chunk_progress",
            "chunk_details",
        ]

    def get_stages(self, obj: IngestionJob) -> list[dict]:
        stages = ensure_stage_metadata(obj)["stages"]
        return [
            stages.get(key, {"key": key, "label": label, "status": "pending", "message": ""})
            for key, label in STAGE_DEFINITIONS
        ]

    def get_chunk_progress(self, obj: IngestionJob) -> dict:
        counts = {
            "total": 0,
            "queued": 0,
            "running": 0,
            "completed": 0,
            "failed": 0,
            "successful_artifacts": 0,
        }
        aggregate = {
            item["status"]: item["count"] for item in obj.chunk_artifacts.values("status").annotate(count=Count("id"))
        }
        counts["queued"] = aggregate.get(ChunkExtractionArtifact.STATUS_QUEUED, 0)
        counts["running"] = aggregate.get(ChunkExtractionArtifact.STATUS_RUNNING, 0)
        counts["completed"] = aggregate.get(ChunkExtractionArtifact.STATUS_COMPLETED, 0)
        counts["failed"] = aggregate.get(ChunkExtractionArtifact.STATUS_FAILED, 0)
        counts["total"] = sum(aggregate.values())
        counts["successful_artifacts"] = counts["completed"]
        return counts

    def get_chunk_details(self, obj: IngestionJob) -> list[dict]:
        return [
            {
                "chunk_id": artifact.chunk_id,
                "chunk_index": artifact.chunk.chunk_index,
                "status": artifact.status,
                "attempt_count": artifact.attempt_count,
                "error_message": artifact.error_message,
                "empty_verification_status": artifact.empty_verification_status,
                "empty_verification_message": artifact.empty_verification_message,
            }
            for artifact in obj.chunk_artifacts.select_related("chunk").order_by("chunk__chunk_index", "id")
        ]


class DocumentEntitySerializer(serializers.ModelSerializer):
    class Meta:
        model = Entity
        fields = ["id", "name", "canonical_name", "entity_type", "description", "confidence", "aliases"]


class DocumentRelationshipSerializer(serializers.ModelSerializer):
    source_name = serializers.CharField(source="source_entity.name", read_only=True)
    target_name = serializers.CharField(source="target_entity.name", read_only=True)

    class Meta:
        model = Relationship
        fields = [
            "id",
            "source_entity",
            "target_entity",
            "source_name",
            "target_name",
            "relationship_type",
            "confidence",
        ]
