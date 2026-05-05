from rest_framework import generics
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.self_healing.models import SelfHealingTask
from apps.self_healing.serializers import SelfHealingTaskSerializer
from apps.self_healing.services.repair_runner import run_task
from apps.self_healing.tasks import run_self_healing_task


class SelfHealingTaskListView(generics.ListAPIView):
    queryset = SelfHealingTask.objects.all()
    serializer_class = SelfHealingTaskSerializer


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


class SelfHealingRunAllView(APIView):
    def post(self, request):
        tasks = SelfHealingTask.objects.filter(status=SelfHealingTask.STATUS_PENDING)[:20]
        queued = []
        for task in tasks:
            run_self_healing_task.delay(task.id)
            queued.append(task.id)
        return Response({"queued_task_ids": queued})

