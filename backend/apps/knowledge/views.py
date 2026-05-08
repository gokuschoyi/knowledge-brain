from rest_framework import generics
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.knowledge.models import Claim, Entity, Relationship
from apps.knowledge.serializers import (
    ClaimSerializer,
    EntitySerializer,
    GraphEntitySerializer,
    RelationshipSerializer,
)


class GraphView(APIView):
    def get(self, request):
        brain_id = request.query_params.get("brain_id")
        entity_qs = Entity.objects.all()
        relationship_qs = Relationship.objects.select_related("source_entity", "target_entity")

        if brain_id:
            entity_qs = entity_qs.filter(mentions__chunk__document__brain_id=brain_id).distinct()
            relationship_qs = relationship_qs.filter(evidence_chunk__document__brain_id=brain_id).distinct()

        connected_entity_ids: set[int] = set()
        edges = []

        for relationship in relationship_qs:
            connected_entity_ids.add(relationship.source_entity_id)
            connected_entity_ids.add(relationship.target_entity_id)
            edges.append(
                {
                    "id": f"rel-{relationship.id}",
                    "source": f"entity-{relationship.source_entity_id}",
                    "target": f"entity-{relationship.target_entity_id}",
                    "label": relationship.relationship_type,
                    "data": {
                        "relationship_id": relationship.id,
                        "confidence": relationship.confidence,
                    },
                }
            )

        connected_nodes = []
        isolated_entities = []

        for entity in entity_qs:
            node = {
                "id": f"entity-{entity.id}",
                "type": "entity",
                "label": entity.name,
                "data": GraphEntitySerializer(entity).data,
            }
            if entity.id in connected_entity_ids:
                connected_nodes.append(node)
            else:
                isolated_entities.append(node)

        return Response(
            {
                "connected_graph": {
                    "nodes": connected_nodes,
                    "edges": edges,
                },
                "isolated_entities": isolated_entities,
            }
        )


class EntityListView(generics.ListAPIView):
    queryset = Entity.objects.all()
    serializer_class = EntitySerializer


class EntityDetailView(generics.RetrieveAPIView):
    queryset = Entity.objects.all()
    serializer_class = EntitySerializer


class EntityRelationshipsView(generics.ListAPIView):
    serializer_class = RelationshipSerializer

    def get_queryset(self):
        entity_id = self.kwargs["pk"]
        return Relationship.objects.filter(source_entity_id=entity_id) | Relationship.objects.filter(target_entity_id=entity_id)


class ClaimListView(generics.ListAPIView):
    queryset = Claim.objects.all()
    serializer_class = ClaimSerializer
