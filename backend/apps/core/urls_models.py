from django.urls import path

from .views import ModelCatalogView

urlpatterns = [path("", ModelCatalogView.as_view())]
