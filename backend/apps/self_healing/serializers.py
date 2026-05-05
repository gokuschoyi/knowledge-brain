from rest_framework import serializers

from apps.self_healing.models import SelfHealingTask


class SelfHealingTaskSerializer(serializers.ModelSerializer):
    related_entity_name = serializers.CharField(source="related_entity.name", read_only=True)
    related_document_title = serializers.CharField(source="related_document.title", read_only=True)

    class Meta:
        model = SelfHealingTask
        fields = "__all__"

