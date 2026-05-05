from rest_framework import generics
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.documents.models import Document
from apps.documents.serializers import DocumentSerializer
from apps.knowledge.models import Claim, Entity, Relationship
from apps.knowledge.serializers import ClaimSerializer, EntitySerializer, RelationshipSerializer


class GraphView(APIView):
    def get(self, request):
        nodes = []
        edges = []

        for document in Document.objects.all()[:50]:
            nodes.append(
                {
                    "id": f"document-{document.id}",
                    "type": "document",
                    "label": document.title,
                    "data": DocumentSerializer(document).data,
                }
            )

        for entity in Entity.objects.all()[:200]:
            nodes.append(
                {
                    "id": f"entity-{entity.id}",
                    "type": "entity",
                    "label": entity.name,
                    "data": EntitySerializer(entity).data,
                }
            )

        for relationship in Relationship.objects.select_related("source_entity", "target_entity")[:300]:
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

        return Response({"nodes": nodes, "edges": edges})


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

