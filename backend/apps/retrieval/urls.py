from django.urls import path

from .views import ChatQueryStreamView, ChatQueryView, ChatSessionDetailView, ChatSessionListView

urlpatterns = [
    path("query/", ChatQueryView.as_view()),
    path("query/stream/", ChatQueryStreamView.as_view()),
    path("sessions/", ChatSessionListView.as_view()),
    path("sessions/<int:pk>/", ChatSessionDetailView.as_view()),
]
