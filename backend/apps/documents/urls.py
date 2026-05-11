from django.urls import path

from .views import (
    ChunkRetryView,
    ChunkWordBboxesView,
    DocumentChunksView,
    DocumentDeleteView,
    DocumentDetailView,
    DocumentEntitiesView,
    DocumentIngestView,
    DocumentListView,
    DocumentRawTextView,
    DocumentRelationshipsView,
    DocumentRetryView,
)

urlpatterns = [
    path("ingest/", DocumentIngestView.as_view()),
    path("", DocumentListView.as_view()),
    path("<int:pk>/", DocumentDetailView.as_view()),
    path("<int:pk>/delete/", DocumentDeleteView.as_view()),
    path("<int:pk>/retry/", DocumentRetryView.as_view()),
    path("<int:pk>/raw-text/", DocumentRawTextView.as_view()),
    path("<int:pk>/chunks/", DocumentChunksView.as_view()),
    path("<int:doc_pk>/chunks/<int:chunk_pk>/retry/", ChunkRetryView.as_view()),
    path("<int:doc_pk>/chunks/<int:chunk_pk>/word-bboxes/", ChunkWordBboxesView.as_view()),
    path("<int:pk>/entities/", DocumentEntitiesView.as_view()),
    path("<int:pk>/relationships/", DocumentRelationshipsView.as_view()),
]
