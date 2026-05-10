from rest_framework import generics, status
from rest_framework.exceptions import ValidationError
from rest_framework.response import Response
from rest_framework.views import APIView
from django.db.models import Q

from apps.self_healing.models import SelfHealingTask
from apps.self_healing.serializers import SelfHealingTaskSerializer
from apps.self_healing.tasks import run_self_healing_task


class SelfHealingTaskListView(generics.ListAPIView):
    serializer_class = SelfHealingTaskSerializer

    def get_queryset(self):
        queryset = SelfHealingTask.objects.select_related(
            "brain",
            "related_document",
            "related_entity",
        )
        brain_id = self.request.query_params.get("brain_id")
        if brain_id:
            queryset = queryset.filter(
                Q(brain_id=brain_id)
                | Q(related_document__brain_id=brain_id)
                | Q(related_entity__brain_id=brain_id)
            ).distinct()
        return queryset


class SelfHealingRunTaskView(APIView):
    def post(self, request, pk: int):
        task = SelfHealingTask.objects.get(id=pk)
        run_self_healing_task.delay(task.id)
        return Response({"status": "queued", "task_id": task.id})


class SelfHealingIgnoreTaskView(APIView):
    def post(self, request, pk: int):
        task = SelfHealingTask.objects.get(id=pk)
        task.status = SelfHealingTask.STATUS_IGNORED
        task.save(update_fields=["status", "updated_at"])
        return Response(SelfHealingTaskSerializer(task).data)


class SelfHealingDeleteTaskView(APIView):
    def delete(self, request, pk: int):
        task = SelfHealingTask.objects.get(id=pk)
        if task.status != SelfHealingTask.STATUS_PENDING:
            raise ValidationError("Only pending self-healing tasks can be deleted.")
        task.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class SelfHealingRunAllView(APIView):
    def post(self, request):
        tasks = SelfHealingTask.objects.filter(status=SelfHealingTask.STATUS_PENDING)
        brain_id = request.data.get("brain_id") or request.query_params.get("brain_id")
        if brain_id:
            tasks = tasks.filter(
                Q(brain_id=brain_id)
                | Q(related_document__brain_id=brain_id)
                | Q(related_entity__brain_id=brain_id)
            ).distinct()
        tasks = tasks[:20]
        queued = []
        for task in tasks:
            run_self_healing_task.delay(task.id)
            queued.append(task.id)
        return Response({"queued_task_ids": queued})
