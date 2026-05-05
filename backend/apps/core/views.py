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
        average_quality = Document.objects.aggregate(avg=Avg("quality_score")).get("avg") or 0
        payload = {
            "documents": Document.objects.count(),
            "chunks": Chunk.objects.count(),
            "entities": Entity.objects.count(),
            "relationships": Relationship.objects.count(),
            "open_self_healing_tasks": SelfHealingTask.objects.filter(
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
