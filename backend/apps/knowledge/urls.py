from django.urls import path

from .views import (
    ClaimListView,
    EntityDetailView,
    EntityListView,
    EntityRelationshipsView,
    EvidenceSpanDetailView,
    EvidenceSpanRenderContextView,
)

urlpatterns = [
    path("entities/", EntityListView.as_view()),
    path("entities/<int:pk>/", EntityDetailView.as_view()),
    path("entities/<int:pk>/relationships/", EntityRelationshipsView.as_view()),
    path("claims/", ClaimListView.as_view()),
    path("evidence-spans/<int:pk>/", EvidenceSpanDetailView.as_view()),
    path("evidence-spans/<int:pk>/render-context/", EvidenceSpanRenderContextView.as_view()),
]
