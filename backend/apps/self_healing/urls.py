from django.urls import path

from .views import SelfHealingIgnoreTaskView, SelfHealingRunAllView, SelfHealingRunTaskView, SelfHealingTaskListView

urlpatterns = [
    path("tasks/", SelfHealingTaskListView.as_view()),
    path("tasks/<int:pk>/run/", SelfHealingRunTaskView.as_view()),
    path("tasks/<int:pk>/ignore/", SelfHealingIgnoreTaskView.as_view()),
    path("run/", SelfHealingRunAllView.as_view()),
]

