from pathlib import Path

from rest_framework import generics, status
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.documents.models import DocumentWord
from apps.knowledge.models import Claim, Entity, EvidenceSpan, Relationship
from apps.self_healing.models import SelfHealingTask
from apps.knowledge.serializers import (
    ClaimSerializer,
    EvidenceSpanSerializer,
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
            supporting_documents = list(
                entity.mentions.select_related("chunk__document")
                .values("chunk__document_id", "chunk__document__title")
                .distinct()[:5]
            )
            open_issue_count = SelfHealingTask.objects.filter(
                related_entity=entity,
                status__in=[
                    SelfHealingTask.STATUS_PENDING,
                    SelfHealingTask.STATUS_RUNNING,
                    SelfHealingTask.STATUS_UNRESOLVED,
                    SelfHealingTask.STATUS_REVIEW_REQUIRED,
                ],
            ).count()
            node = {
                "id": f"entity-{entity.id}",
                "type": "entity",
                "label": entity.name,
                "data": {
                    **GraphEntitySerializer(entity).data,
                    "supporting_documents": [
                        {
                            "id": item["chunk__document_id"],
                            "title": item["chunk__document__title"],
                        }
                        for item in supporting_documents
                    ],
                    "open_issue_count": open_issue_count,
                    "has_contradictions": bool(entity.metadata.get("has_contradictions")),
                },
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
        return Relationship.objects.filter(source_entity_id=entity_id) | Relationship.objects.filter(
            target_entity_id=entity_id
        )


class ClaimListView(generics.ListAPIView):
    queryset = Claim.objects.all()
    serializer_class = ClaimSerializer


class EvidenceSpanDetailView(generics.RetrieveAPIView):
    queryset = EvidenceSpan.objects.select_related("document", "chunk", "chat_message")
    serializer_class = EvidenceSpanSerializer


class EvidenceSpanRenderContextView(APIView):
    def get(self, request, pk: int):
        try:
            evidence_span = EvidenceSpan.objects.select_related("document", "chunk", "chat_message").get(id=pk)
        except EvidenceSpan.DoesNotExist:
            return Response({"detail": "Not found."}, status=status.HTTP_404_NOT_FOUND)

        locator_payload = evidence_span.locator_payload or {}
        document = evidence_span.document
        file_extension = None
        if document.raw_file:
            file_extension = Path(document.raw_file.name).suffix.lstrip(".").lower()

        word_records = []
        if evidence_span.primary_locator_type == EvidenceSpan.LOCATOR_PDF_PAGE_BBOX:
            words = DocumentWord.objects.filter(
                document=document,
                end_char__gt=evidence_span.span_start_char,
                start_char__lt=evidence_span.span_end_char,
            ).order_by("page_number", "reading_order", "id")
            word_records = [
                {
                    "id": word.id,
                    "page_number": word.page_number,
                    "text": word.text,
                    "start_char": word.start_char,
                    "end_char": word.end_char,
                    "bbox": word.bbox,
                    "reading_order": word.reading_order,
                    "block_index": word.block_index,
                    "line_index": word.line_index,
                    "extraction_source": word.extraction_source,
                }
                for word in words
            ]

        return Response(
            {
                "evidence_span": EvidenceSpanSerializer(evidence_span, context={"request": request}).data,
                "document": {
                    "id": document.id,
                    "title": document.title,
                    "source_type": document.source_type,
                    "file_extension": file_extension,
                    "text": document.extracted_text or document.raw_text or "",
                    "structure_metadata": document.structure_metadata or {},
                    "raw_file_url": request.build_absolute_uri(document.raw_file.url) if document.raw_file else None,
                },
                "locator_type": evidence_span.primary_locator_type,
                "locator_payload": locator_payload,
                "word_records": word_records,
            }
        )
