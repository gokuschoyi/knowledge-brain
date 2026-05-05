from rest_framework import serializers

from apps.core.llm_catalog import DEFAULT_MODEL, DEFAULT_PROVIDER, MODEL_CATALOG
from apps.documents.models import Chunk, Document, IngestionJob
from apps.knowledge.models import Entity, Relationship


class DocumentIngestSerializer(serializers.ModelSerializer):
    class Meta:
        model = Document
        fields = ["brain", "title", "source_type", "raw_text", "raw_file", "url", "tags", "llm_provider", "llm_model"]

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
        ]


class DocumentSerializer(serializers.ModelSerializer):
    chunks_count = serializers.IntegerField(source="chunks.count", read_only=True)

    class Meta:
        model = Document
        fields = [
            "id",
            "title",
            "source_type",
            "tags",
            "llm_provider",
            "llm_model",
            "status",
            "summary",
            "quality_score",
            "error_message",
            "created_at",
            "updated_at",
            "chunks_count",
        ]


class IngestionJobSerializer(serializers.ModelSerializer):
    class Meta:
        model = IngestionJob
        fields = "__all__"


class DocumentEntitySerializer(serializers.ModelSerializer):
    class Meta:
        model = Entity
        fields = ["id", "name", "canonical_name", "entity_type", "description", "confidence", "aliases"]


class DocumentRelationshipSerializer(serializers.ModelSerializer):
    source_name = serializers.CharField(source="source_entity.name", read_only=True)
    target_name = serializers.CharField(source="target_entity.name", read_only=True)

    class Meta:
        model = Relationship
        fields = ["id", "source_entity", "target_entity", "source_name", "target_name", "relationship_type", "confidence"]
