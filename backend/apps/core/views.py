from django.conf import settings
from django.db.models import Avg, Count, Q
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
        payload = {
            "documents": documents.count(),
            "chunks": chunks.count(),
            "entities": entities.count(),
            "relationships": relationships.count(),
            "open_self_healing_tasks": tasks.filter(
                Q(status=SelfHealingTask.STATUS_PENDING) | Q(status=SelfHealingTask.STATUS_RUNNING)
            ).count(),
            "average_quality_score": round(average_quality, 2),
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
