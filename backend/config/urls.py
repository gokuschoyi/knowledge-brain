from django.conf import settings
from django.conf.urls.static import static
from django.contrib import admin
from django.urls import include, path
from rest_framework.response import Response
from rest_framework.views import APIView


class HealthView(APIView):
    authentication_classes = []
    permission_classes = []

    def get(self, request):
        return Response({"status": "ok"})


urlpatterns = [
    path("admin/", admin.site.urls),
    path("api/health/", HealthView.as_view()),
    path("api/documents/", include("apps.documents.urls")),
    path("api/ingestion/", include("apps.documents.urls_ingestion")),
    path("api/chat/", include("apps.retrieval.urls")),
    path("api/graph/", include("apps.knowledge.urls_graph")),
    path("api/", include("apps.knowledge.urls")),
    path("api/self-healing/", include("apps.self_healing.urls")),
    path("api/dashboard/", include("apps.core.urls")),
    path("api/models/", include("apps.core.urls_models")),
] + static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
