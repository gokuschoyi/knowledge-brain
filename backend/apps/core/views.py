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
from apps.knowledge.models import Claim, Entity, Relationship
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
        authority_weights = {
            Document.AUTHORITY_PRIMARY: 1.0,
            Document.AUTHORITY_SECONDARY: 0.7,
            Document.AUTHORITY_USER: 0.4,
            Document.AUTHORITY_UNKNOWN: 0.0,
        }
        brain_id = request.query_params.get("brain_id")
        documents = Document.objects.all()
        chunks = Chunk.objects.all()
        entities = Entity.objects.all()
        relationships = Relationship.objects.all()
        claims = Claim.objects.all()
        tasks = SelfHealingTask.objects.all()

        if brain_id:
            documents = documents.filter(brain_id=brain_id)
            chunks = chunks.filter(document__brain_id=brain_id)
            entities = entities.filter(brain_id=brain_id)
            relationships = relationships.filter(evidence_chunk__document__brain_id=brain_id)
            claims = claims.filter(source_chunk__document__brain_id=brain_id)
            tasks = tasks.filter(brain_id=brain_id)

        average_quality = documents.aggregate(avg=Avg("quality_score")).get("avg") or 0
        completed_documents = documents.filter(status=Document.STATUS_COMPLETED)
        failed_documents = documents.filter(status=Document.STATUS_FAILED)
        processing_documents = documents.filter(
            Q(status=Document.STATUS_PENDING) | Q(status=Document.STATUS_PROCESSING)
        )
        linked_entity_ids = set(relationships.values_list("source_entity_id", flat=True)) | set(
            relationships.values_list("target_entity_id", flat=True)
        )
        isolated_entities_count = max(0, entities.count() - len(linked_entity_ids))
        entity_link_percent = float(len(linked_entity_ids) / max(entities.count(), 1) * 100)
        authority_covered_documents = documents.exclude(source_authority=Document.AUTHORITY_UNKNOWN)
        authority_score_total = sum(
            authority_weights.get(document.source_authority, 0.0)
            for document in documents
        )
        authority_score_percent = authority_score_total / max(documents.count(), 1) * 100
        freshness_covered_documents = documents.filter(
            Q(source_published_at__isnull=False) | Q(source_observed_at__isnull=False)
        )
        unresolved_contradictions = tasks.filter(
            task_type=SelfHealingTask.TYPE_CONTRADICTION,
            status__in=[
                SelfHealingTask.STATUS_PENDING,
                SelfHealingTask.STATUS_RUNNING,
                SelfHealingTask.STATUS_REVIEW_REQUIRED,
            ],
        ).count()
        unresolved_low_confidence = tasks.filter(
            task_type=SelfHealingTask.TYPE_LOW_CONFIDENCE_ANSWER,
            status__in=[
                SelfHealingTask.STATUS_PENDING,
                SelfHealingTask.STATUS_RUNNING,
                SelfHealingTask.STATUS_UNRESOLVED,
            ],
        ).count()
        reviewed_claims = claims.filter(
            contradiction_review_state__in=[
                Claim.REVIEW_ACTIVE,
                Claim.REVIEW_AUTHORITATIVE,
                Claim.REVIEW_SUPERSEDED,
            ]
        ).count()
        freshness_score_percent = (
            freshness_covered_documents.count() / max(documents.count(), 1) * 100
        )
        claim_review_coverage_percent = (
            reviewed_claims / max(claims.count(), 1) * 100
        )
        contradiction_health_percent = max(
            0.0,
            100.0 - min(100.0, unresolved_contradictions * 20.0),
        )
        trust_score_percent = (
            (authority_score_percent * 0.45)
            + (freshness_score_percent * 0.2)
            + (claim_review_coverage_percent * 0.2)
            + (contradiction_health_percent * 0.15)
        )

        chart_source = {
            "Extraction": float(chunks.exclude(summary="").count() / max(chunks.count(), 1) * 100),
            "Entity Link": entity_link_percent,
            "Quality": float(average_quality * 100),
            "Trust": float(trust_score_percent),
            "Repair Pressure": float(
                max(
                    0,
                    100
                    - (
                        tasks.filter(
                            Q(status=SelfHealingTask.STATUS_PENDING)
                            | Q(status=SelfHealingTask.STATUS_RUNNING)
                            | Q(status=SelfHealingTask.STATUS_UNRESOLVED)
                            | Q(status=SelfHealingTask.STATUS_REVIEW_REQUIRED)
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
                Q(status=SelfHealingTask.STATUS_PENDING)
                | Q(status=SelfHealingTask.STATUS_RUNNING)
                | Q(status=SelfHealingTask.STATUS_UNRESOLVED)
                | Q(status=SelfHealingTask.STATUS_REVIEW_REQUIRED)
            ).count(),
            "unresolved_contradictions": unresolved_contradictions,
            "unresolved_low_confidence": unresolved_low_confidence,
            "isolated_entities": isolated_entities_count,
            "reviewed_claims": reviewed_claims,
            "trust_score_percent": round(trust_score_percent, 1),
            "claim_review_coverage_percent": round(
                claim_review_coverage_percent,
                1,
            ),
            "contradiction_health_percent": round(
                contradiction_health_percent,
                1,
            ),
            "authority_coverage_percent": round(
                authority_covered_documents.count() / max(documents.count(), 1) * 100,
                1,
            ),
            "freshness_coverage_percent": round(
                freshness_score_percent,
                1,
            ),
            "average_quality_score": round(average_quality, 2),
            "quality_score_percent": round(average_quality * 100, 1),
            "hero": {
                "status": "Focused intelligence" if selected_brain else "Workspace wide",
                "title": selected_brain.name if selected_brain else "Knowledge Brain Fleet",
                "description": (
                    selected_brain.description
                    if selected_brain and selected_brain.description
                    else (
                        "Monitoring the active brain across ingestion, retrieval, graph structure, and repair."
                        if selected_brain
                        else "Monitoring all brains across ingestion, retrieval, graph structure, and repair."
                    )
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
                    "tone": (
                        "warning"
                        if label == "Repair Pressure"
                        else "cyan" if label in {"Quality", "Trust"} else "indigo"
                    ),
                }
                for label, value in chart_source.items()
            ],
            "recommended_actions": [
                {
                    "label": "Review contradictions",
                    "count": unresolved_contradictions,
                    "href": "/self-healing?task_type=contradiction",
                },
                {
                    "label": "Add missing evidence",
                    "count": unresolved_low_confidence,
                    "href": "/self-healing?task_type=low_confidence_answer",
                },
                {
                    "label": "Define isolated entities",
                    "count": isolated_entities_count,
                    "href": "/graph?tab=isolated",
                },
                {
                    "label": "Inspect weak documents",
                    "count": failed_documents.count(),
                    "href": "/documents?status=failed",
                },
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
