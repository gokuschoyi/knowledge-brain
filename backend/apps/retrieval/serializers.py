from rest_framework import serializers

from apps.core.llm_catalog import DEFAULT_MODEL, DEFAULT_PROVIDER, MODEL_CATALOG
from apps.knowledge.models import ChatMessage, ChatSession


class ChatQuerySerializer(serializers.Serializer):
    session_id = serializers.IntegerField(required=False, allow_null=True)
    brain_id = serializers.UUIDField(required=False, allow_null=True)
    question = serializers.CharField()
    llm_provider = serializers.CharField(required=False, allow_blank=True, allow_null=True)
    llm_model = serializers.CharField(required=False, allow_blank=True, allow_null=True)

    def validate(self, attrs):
        provider = attrs.get("llm_provider") or DEFAULT_PROVIDER
        model_name = attrs.get("llm_model") or DEFAULT_MODEL
        provider_info = MODEL_CATALOG.get(provider)
        if provider_info is None:
            raise serializers.ValidationError("Unsupported answer provider.")
        supported_models = {item["id"] for item in provider_info["models"]}
        if model_name not in supported_models:
            raise serializers.ValidationError("Unsupported answer model for the selected provider.")
        attrs["llm_provider"] = provider
        attrs["llm_model"] = model_name
        return attrs


class ChatMessageSerializer(serializers.ModelSerializer):
    source_count = serializers.SerializerMethodField()

    class Meta:
        model = ChatMessage
        fields = "__all__"

    def get_source_count(self, obj):
        return len(obj.sources or [])


class ChatSessionSerializer(serializers.ModelSerializer):
    messages = ChatMessageSerializer(many=True, read_only=True)
    message_count = serializers.SerializerMethodField()
    last_message_at = serializers.SerializerMethodField()
    brain_name = serializers.CharField(source="brain.name", read_only=True)

    class Meta:
        model = ChatSession
        fields = [
            "id",
            "title",
            "created_at",
            "messages",
            "message_count",
            "last_message_at",
            "brain_name",
        ]

    def get_message_count(self, obj):
        return obj.messages.count()

    def get_last_message_at(self, obj):
        last_message = obj.messages.order_by("-created_at").first()
        return last_message.created_at if last_message else obj.created_at
