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
    class Meta:
        model = ChatMessage
        fields = "__all__"


class ChatSessionSerializer(serializers.ModelSerializer):
    messages = ChatMessageSerializer(many=True, read_only=True)

    class Meta:
        model = ChatSession
        fields = ["id", "title", "created_at", "messages"]
