from rest_framework import generics, status
from rest_framework.parsers import FormParser, JSONParser, MultiPartParser
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.documents.models import Chunk, Document, IngestionJob
from apps.documents.services.document_cleanup import delete_document_and_cleanup
from apps.documents.serializers import (
    ChunkSerializer,
    DocumentEntitySerializer,
    DocumentIngestSerializer,
    DocumentRelationshipSerializer,
    DocumentSerializer,
    IngestionJobSerializer,
)
from apps.documents.tasks import run_document_ingestion
from apps.knowledge.models import Entity, Relationship


class DocumentIngestView(APIView):
    parser_classes = [JSONParser, MultiPartParser, FormParser]

    def post(self, request):
        serializer = DocumentIngestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        document = serializer.save()
        job = IngestionJob.objects.create(document=document)
        run_document_ingestion.delay(document.id, job.id)
        return Response({"document_id": document.id, "job_id": job.id, "status": job.status}, status=status.HTTP_201_CREATED)


class DocumentListView(generics.ListAPIView):
    queryset = Document.objects.all()
    serializer_class = DocumentSerializer


class DocumentDetailView(generics.RetrieveAPIView):
    queryset = Document.objects.all()
    serializer_class = DocumentSerializer


class DocumentDeleteView(APIView):
    def delete(self, request, pk: int):
        document = Document.objects.get(id=pk)
        delete_document_and_cleanup(document)
        return Response(status=status.HTTP_204_NO_CONTENT)


class DocumentRetryView(APIView):
    def post(self, request, pk: int):
        document = Document.objects.get(id=pk)
        if document.status != Document.STATUS_FAILED:
            return Response(
                {"detail": "Only failed documents can be retried."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        document.status = Document.STATUS_PENDING
        document.error_message = ""
        document.save(update_fields=["status", "error_message", "updated_at"])
        job = IngestionJob.objects.create(document=document)
        run_document_ingestion.delay(document.id, job.id)
        return Response(
            {"document_id": document.id, "job_id": job.id, "status": job.status},
            status=status.HTTP_202_ACCEPTED,
        )


class DocumentChunksView(generics.ListAPIView):
    serializer_class = ChunkSerializer

    def get_queryset(self):
        return Chunk.objects.filter(document_id=self.kwargs["pk"])


class DocumentEntitiesView(generics.ListAPIView):
    serializer_class = DocumentEntitySerializer

    def get_queryset(self):
        return Entity.objects.filter(mentions__chunk__document_id=self.kwargs["pk"]).distinct()


class DocumentRelationshipsView(generics.ListAPIView):
    serializer_class = DocumentRelationshipSerializer

    def get_queryset(self):
        return Relationship.objects.filter(evidence_chunk__document_id=self.kwargs["pk"]).select_related(
            "source_entity", "target_entity"
        )


class IngestionJobDetailView(generics.RetrieveAPIView):
    queryset = IngestionJob.objects.all()
    serializer_class = IngestionJobSerializer


class IngestionJobEventsView(generics.RetrieveAPIView):
    queryset = IngestionJob.objects.all()
    serializer_class = IngestionJobSerializer
