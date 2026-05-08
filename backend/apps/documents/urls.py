from django.urls import path

from .views import (
    ChunkRetryView,
    DocumentChunksView,
    DocumentDeleteView,
    DocumentDetailView,
    DocumentEntitiesView,
    DocumentIngestView,
    DocumentListView,
    DocumentRelationshipsView,
    DocumentRetryView,
)

urlpatterns = [
    path("ingest/", DocumentIngestView.as_view()),
    path("", DocumentListView.as_view()),
    path("<int:pk>/", DocumentDetailView.as_view()),
    path("<int:pk>/delete/", DocumentDeleteView.as_view()),
    path("<int:pk>/retry/", DocumentRetryView.as_view()),
    path("<int:pk>/chunks/", DocumentChunksView.as_view()),
    path("<int:doc_pk>/chunks/<int:chunk_pk>/retry/", ChunkRetryView.as_view()),
    path("<int:pk>/entities/", DocumentEntitiesView.as_view()),
    path("<int:pk>/relationships/", DocumentRelationshipsView.as_view()),
]
