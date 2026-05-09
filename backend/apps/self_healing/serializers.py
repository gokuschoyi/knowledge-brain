from rest_framework import serializers

from apps.self_healing.models import SelfHealingTask


class SelfHealingTaskSerializer(serializers.ModelSerializer):
    related_entity_name = serializers.CharField(source="related_entity.name", read_only=True)
    related_document_title = serializers.CharField(source="related_document.title", read_only=True)
    brain_name = serializers.CharField(source="brain.name", read_only=True)
    priority_label = serializers.SerializerMethodField()
    task_type_label = serializers.SerializerMethodField()
    can_run = serializers.SerializerMethodField()
    can_delete = serializers.SerializerMethodField()

    class Meta:
        model = SelfHealingTask
        fields = "__all__"

    def get_priority_label(self, obj):
        if obj.priority >= 8:
            return "critical"
        if obj.priority >= 5:
            return "high"
        if obj.priority >= 3:
            return "medium"
        return "low"

    def get_task_type_label(self, obj):
        return obj.task_type.replace("_", " ")

    def get_can_run(self, obj):
        return obj.status not in {
            SelfHealingTask.STATUS_RUNNING,
            SelfHealingTask.STATUS_COMPLETED,
        } and obj.task_type != SelfHealingTask.TYPE_ORPHAN_CHUNK

    def get_can_delete(self, obj):
        return obj.status == SelfHealingTask.STATUS_PENDING
