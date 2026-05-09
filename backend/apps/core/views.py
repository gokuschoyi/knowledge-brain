from django.conf import settings
from django.db.models import Avg, Q
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.core.llm_catalog import (
    DEFAULT_MODEL,
    DEFAULT_PROVIDER,
    MODEL_CATALOG,
)
from apps.agents.llm import get_available_embedding_catalog, get_default_embedding_provider_model
from apps.documents.models import Chunk, Document
from apps.knowledge.models import Entity, Relationship
from apps.self_healing.models import SelfHealingTask

from rest_framework import generics
from .models import Brain
from .serializers import BrainSerializer

class BrainListCreateView(generics.ListCreateAPIView):
    queryset = Brain.objects.all()
    serializer_class = BrainSerializer

class BrainDetailView(generics.RetrieveUpdateDestroyAPIView):
    queryset = Brain.objects.all()
    serializer_class = BrainSerializer

class DashboardView(APIView):
    def get(self, request):
        brain_id = request.query_params.get("brain_id")
        documents = Document.objects.all()
        chunks = Chunk.objects.all()
        entities = Entity.objects.all()
        relationships = Relationship.objects.all()
        tasks = SelfHealingTask.objects.all()

        if brain_id:
            documents = documents.filter(brain_id=brain_id)
            chunks = chunks.filter(document__brain_id=brain_id)
            entities = entities.filter(brain_id=brain_id)
            relationships = relationships.filter(evidence_chunk__document__brain_id=brain_id)
            tasks = tasks.filter(brain_id=brain_id)

        average_quality = documents.aggregate(avg=Avg("quality_score")).get("avg") or 0
        completed_documents = documents.filter(status=Document.STATUS_COMPLETED)
        failed_documents = documents.filter(status=Document.STATUS_FAILED)
        processing_documents = documents.filter(
            Q(status=Document.STATUS_PENDING) | Q(status=Document.STATUS_PROCESSING)
        )
        linked_entity_ids = set(
            relationships.values_list("source_entity_id", flat=True)
        ) | set(
            relationships.values_list("target_entity_id", flat=True)
        )
        entity_link_percent = float(
            len(linked_entity_ids) / max(entities.count(), 1) * 100
        )

        chart_source = {
            "Extraction": float(
                chunks.exclude(summary="").count() / max(chunks.count(), 1) * 100
            ),
            "Entity Link": entity_link_percent,
            "Quality": float(average_quality * 100),
            "Repair Readiness": float(
                max(
                    0,
                    100
                    - (
                        tasks.filter(
                            Q(status=SelfHealingTask.STATUS_PENDING)
                            | Q(status=SelfHealingTask.STATUS_RUNNING)
                        ).count()
                        * 12
                    ),
                )
            ),
        }

        selected_brain = Brain.objects.filter(id=brain_id).first() if brain_id else None
        payload = {
            "documents": documents.count(),
            "chunks": chunks.count(),
            "entities": entities.count(),
            "relationships": relationships.count(),
            "open_self_healing_tasks": tasks.filter(
                Q(status=SelfHealingTask.STATUS_PENDING) | Q(status=SelfHealingTask.STATUS_RUNNING)
            ).count(),
            "average_quality_score": round(average_quality, 2),
            "quality_score_percent": round(average_quality * 100, 1),
            "hero": {
                "status": "Focused intelligence" if selected_brain else "Workspace wide",
                "title": selected_brain.name if selected_brain else "Knowledge Brain Fleet",
                "description": selected_brain.description
                if selected_brain and selected_brain.description
                else (
                    "Monitoring the active brain across ingestion, retrieval, graph structure, and repair."
                    if selected_brain
                    else "Monitoring all brains across ingestion, retrieval, graph structure, and repair."
                ),
                "documents_completed": completed_documents.count(),
                "documents_failed": failed_documents.count(),
                "documents_processing": processing_documents.count(),
            },
            "brain_summary": (
                {
                    "id": str(selected_brain.id),
                    "name": selected_brain.name,
                    "description": selected_brain.description or "",
                    "created_at": selected_brain.created_at,
                    "updated_at": selected_brain.updated_at,
                    "auto_repair_enabled": selected_brain.auto_repair_enabled,
                    "auto_repair_safe_only": selected_brain.auto_repair_safe_only,
                    "auto_repair_allowed_types": selected_brain.auto_repair_allowed_types,
                    "auto_repair_frequency_minutes": selected_brain.auto_repair_frequency_minutes,
                    "last_auto_repair_at": selected_brain.last_auto_repair_at,
                }
                if selected_brain
                else None
            ),
            "analytics": [
                {
                    "label": label,
                    "value": round(value, 1),
                    "tone": "warning" if label == "Repair Readiness" else "cyan" if label == "Quality" else "indigo",
                }
                for label, value in chart_source.items()
            ],
        }
        return Response(payload)


class ModelCatalogView(APIView):
    def get(self, request):
        embedding_provider, embedding_model = get_default_embedding_provider_model()
        return Response(
            {
                "default_provider": settings.DEFAULT_LLM_PROVIDER or DEFAULT_PROVIDER,
                "default_model": settings.DEFAULT_LLM_MODEL or DEFAULT_MODEL,
                "providers": MODEL_CATALOG,
                "embedding_provider": embedding_provider,
                "embedding_model": embedding_model,
                "embedding": get_available_embedding_catalog(),
            }
        )
