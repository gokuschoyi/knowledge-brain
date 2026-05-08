from rest_framework import serializers

from apps.knowledge.models import Claim, Entity, Relationship


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
