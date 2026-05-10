from rest_framework import generics, status
from rest_framework.exceptions import ValidationError
from rest_framework.parsers import FormParser, JSONParser, MultiPartParser
from rest_framework.response import Response
from rest_framework.views import APIView
from django.db.models import Q

from apps.documents.models import IngestionJob
from apps.documents.tasks import run_document_ingestion
from apps.self_healing.models import SelfHealingTask
from apps.self_healing.serializers import (
    SelfHealingEvidenceSerializer,
    SelfHealingTaskSerializer,
)
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
        task_type = self.request.query_params.get("task_type")
        related_entity_id = self.request.query_params.get("related_entity_id")
        if brain_id:
            queryset = queryset.filter(
                Q(brain_id=brain_id) | Q(related_document__brain_id=brain_id) | Q(related_entity__brain_id=brain_id)
            ).distinct()
        if task_type:
            queryset = queryset.filter(task_type=task_type)
        if related_entity_id:
            queryset = queryset.filter(related_entity_id=related_entity_id)
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


class SelfHealingAttachEvidenceView(APIView):
    parser_classes = [JSONParser, MultiPartParser, FormParser]

    def post(self, request, pk: int):
        task = SelfHealingTask.objects.get(id=pk)
        if not task.brain_id:
            raise ValidationError("This task is not attached to a brain.")

        payload = request.data.copy()
        payload["brain"] = str(task.brain_id)
        tags = payload.getlist("tags") if hasattr(payload, "getlist") else payload.get("tags", [])
        if not isinstance(tags, list):
            tags = [tags] if tags else []
        tags = [tag for tag in tags if isinstance(tag, str) and tag]
        tags.extend(["self-healing-evidence", f"task-{task.id}"])
        payload.setlist("tags", tags) if hasattr(payload, "setlist") else payload.update({"tags": tags})

        serializer = SelfHealingEvidenceSerializer(data=payload)
        serializer.is_valid(raise_exception=True)
        document = serializer.save()
        job = IngestionJob.objects.create(document=document)
        run_document_ingestion.delay(document.id, job.id)

        rerun_task = bool(serializer.validated_data.get("rerun_task"))
        response_payload = {
            "document_id": document.id,
            "job_id": job.id,
            "status": job.status,
            "task_id": task.id,
            "rerun_task_recommended": True,
        }
        if rerun_task:
            response_payload["next_action"] = "rerun_task_after_ingestion"
        return Response(response_payload, status=status.HTTP_201_CREATED)


class SelfHealingRunAllView(APIView):
    def post(self, request):
        tasks = SelfHealingTask.objects.filter(status=SelfHealingTask.STATUS_PENDING)
        brain_id = request.data.get("brain_id") or request.query_params.get("brain_id")
        if brain_id:
            tasks = tasks.filter(
                Q(brain_id=brain_id) | Q(related_document__brain_id=brain_id) | Q(related_entity__brain_id=brain_id)
            ).distinct()
        tasks = tasks[:20]
        queued = []
        for task in tasks:
            run_self_healing_task.delay(task.id)
            queued.append(task.id)
        return Response({"queued_task_ids": queued})
