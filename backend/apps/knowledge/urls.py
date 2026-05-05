from django.urls import path

from .views import ClaimListView, EntityDetailView, EntityListView, EntityRelationshipsView

urlpatterns = [
    path("entities/", EntityListView.as_view()),
    path("entities/<int:pk>/", EntityDetailView.as_view()),
    path("entities/<int:pk>/relationships/", EntityRelationshipsView.as_view()),
    path("claims/", ClaimListView.as_view()),
]

