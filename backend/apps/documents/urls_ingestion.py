from django.urls import path

from .views import IngestionJobBatchView, IngestionJobDetailView, IngestionJobEventsView

urlpatterns = [
    path("jobs/batch/", IngestionJobBatchView.as_view()),
    path("jobs/<int:pk>/", IngestionJobDetailView.as_view()),
    path("jobs/<int:pk>/events/", IngestionJobEventsView.as_view()),
]

