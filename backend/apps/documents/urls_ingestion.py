from django.urls import path

from .views import IngestionJobDetailView, IngestionJobEventsView

urlpatterns = [
    path("jobs/<int:pk>/", IngestionJobDetailView.as_view()),
    path("jobs/<int:pk>/events/", IngestionJobEventsView.as_view()),
]

