from rest_framework import serializers

from pathlib import Path

from apps.knowledge.models import Claim, Entity, EvidenceSpan, Relationship


class EntitySerializer(serializers.ModelSerializer):
    class Meta:
        model = Entity
        fields = "__all__"


class GraphEntitySerializer(serializers.ModelSerializer):
    class Meta:
        model = Entity
        exclude = ["embedding","retrieval_text"]


class RelationshipSerializer(serializers.ModelSerializer):
    source_name = serializers.CharField(source="source_entity.name", read_only=True)
    target_name = serializers.CharField(source="target_entity.name", read_only=True)

    class Meta:
        model = Relationship
        fields = "__all__"


class ClaimSerializer(serializers.ModelSerializer):
    subject_name = serializers.CharField(source="subject_entity.name", read_only=True)

    class Meta:
        model = Claim
        fields = "__all__"


class EvidenceSpanSerializer(serializers.ModelSerializer):
    document_title = serializers.CharField(source="document.title", read_only=True)
    source_type = serializers.CharField(source="document.source_type", read_only=True)
    raw_file_url = serializers.SerializerMethodField()
    file_extension = serializers.SerializerMethodField()

    class Meta:
        model = EvidenceSpan
        fields = [
            "id",
            "document",
            "document_title",
            "chunk",
            "chat_message",
            "quote_text",
            "span_start_char",
            "span_end_char",
            "primary_locator_type",
            "locator_payload",
            "created_from",
            "review_status",
            "notes",
            "created_at",
            "updated_at",
            "source_type",
            "raw_file_url",
            "file_extension",
        ]

    def get_raw_file_url(self, obj):
        if obj.document.raw_file:
            request = self.context.get("request")
            if request:
                return request.build_absolute_uri(obj.document.raw_file.url)
            return obj.document.raw_file.url
        return None

    def get_file_extension(self, obj):
        if obj.document.raw_file:
            return Path(obj.document.raw_file.name).suffix.lstrip(".").lower()
        return None
