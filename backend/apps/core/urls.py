from django.urls import path

from .views import DashboardView, BrainListCreateView, BrainDetailView

urlpatterns = [
    path("", DashboardView.as_view()),
    path("brains/", BrainListCreateView.as_view()),
    path("brains/<uuid:pk>/", BrainDetailView.as_view()),
]
