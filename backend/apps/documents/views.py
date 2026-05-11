from rest_framework import generics, status
from rest_framework.parsers import FormParser, JSONParser, MultiPartParser
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.documents.models import Chunk, ChunkExtractionArtifact, Document, DocumentWord, IngestionJob
from apps.documents.services.document_cleanup import delete_document_and_cleanup
from apps.documents.serializers import (
    ChunkSerializer,
    DocumentEntitySerializer,
    DocumentIngestSerializer,
    DocumentRelationshipSerializer,
    DocumentSerializer,
    IngestionJobSerializer,
)
from apps.documents.tasks import run_chunk_bundled_extraction, run_document_ingestion
from apps.knowledge.models import Entity, Relationship
from apps.self_healing.services.post_ingestion_repair import build_ingestion_job_metadata


class DocumentIngestView(APIView):
    parser_classes = [JSONParser, MultiPartParser, FormParser]

    def post(self, request):
        serializer = DocumentIngestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        document = serializer.save()
        job = IngestionJob.objects.create(
            document=document,
            metadata=build_ingestion_job_metadata(serializer.validated_data.get("batch_token")),
        )
        run_document_ingestion.delay(document.id, job.id)
        return Response(
            {"document_id": document.id, "job_id": job.id, "status": job.status}, status=status.HTTP_201_CREATED
        )


class DocumentListView(generics.ListAPIView):
    serializer_class = DocumentSerializer

    def get_queryset(self):
        queryset = Document.objects.all()
        brain_id = self.request.query_params.get("brain_id")
        entity_id = self.request.query_params.get("entity_id")
        if brain_id:
            queryset = queryset.filter(brain_id=brain_id)
        if entity_id:
            queryset = queryset.filter(chunks__entity_mentions__entity_id=entity_id).distinct()
        return queryset


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
        return Chunk.objects.filter(document_id=self.kwargs["pk"]).prefetch_related(
            "extraction_artifacts",
            "entity_mentions",
            "relationships",
            "claims",
        )


class ChunkRetryView(APIView):
    def post(self, request, doc_pk: int, chunk_pk: int):
        artifact = (
            ChunkExtractionArtifact.objects.filter(chunk_id=chunk_pk, chunk__document_id=doc_pk).order_by("-id").first()
        )
        if artifact is None:
            return Response({"detail": "Chunk artifact not found."}, status=status.HTTP_404_NOT_FOUND)
        artifact.status = ChunkExtractionArtifact.STATUS_QUEUED
        artifact.error_message = ""
        artifact.empty_verification_status = ChunkExtractionArtifact.EMPTY_CHECK_NOT_NEEDED
        artifact.empty_verification_message = ""
        artifact.save(
            update_fields=[
                "status",
                "error_message",
                "empty_verification_status",
                "empty_verification_message",
                "updated_at",
            ]
        )
        run_chunk_bundled_extraction.delay(artifact.id)
        return Response({"artifact_id": artifact.id, "status": artifact.status}, status=status.HTTP_202_ACCEPTED)


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


class DocumentRawTextView(APIView):
    """GET /api/documents/<pk>/raw-text/
    Returns the document's extracted text and page boundaries for the source drawer."""

    def get(self, request, pk: int):
        try:
            document = Document.objects.get(id=pk)
        except Document.DoesNotExist:
            return Response({"detail": "Not found."}, status=status.HTTP_404_NOT_FOUND)

        from pathlib import Path as _Path

        file_extension = None
        if document.raw_file:
            file_extension = _Path(document.raw_file.name).suffix.lstrip(".").lower()

        page_boundaries = []
        if file_extension == "pdf":
            page_boundaries = (document.structure_metadata or {}).get("page_boundaries", [])

        return Response({
            "document_id": document.id,
            "source_type": document.source_type,
            "file_extension": file_extension,
            "text": document.extracted_text or document.raw_text or "",
            "page_boundaries": page_boundaries,
            "structure_metadata": document.structure_metadata or {},
            "raw_file_url": request.build_absolute_uri(document.raw_file.url) if document.raw_file else None,
        })


class ChunkWordBboxesView(APIView):
    """GET /api/documents/<doc_pk>/chunks/<chunk_pk>/word-bboxes/
    Returns word-level bounding boxes stored during PDF ingestion."""

    def get(self, request, doc_pk: int, chunk_pk: int):
        try:
            chunk = Chunk.objects.get(id=chunk_pk, document_id=doc_pk)
        except Chunk.DoesNotExist:
            return Response({"detail": "Not found."}, status=status.HTTP_404_NOT_FOUND)

        meta = chunk.metadata or {}
        words = DocumentWord.objects.filter(
            document_id=doc_pk,
            end_char__gt=meta.get("start_char", 0),
            start_char__lt=meta.get("end_char", 0),
        ).order_by("page_number", "reading_order", "id")
        return Response({"chunk_id": chunk_pk, "word_bboxes": [word.bbox for word in words]})


class IngestionJobDetailView(generics.RetrieveAPIView):
    queryset = IngestionJob.objects.prefetch_related("chunk_artifacts__chunk")
    serializer_class = IngestionJobSerializer


class IngestionJobEventsView(generics.RetrieveAPIView):
    queryset = IngestionJob.objects.prefetch_related("chunk_artifacts__chunk")
    serializer_class = IngestionJobSerializer


class IngestionJobBatchView(APIView):
    """GET /api/ingestion/jobs/batch/?ids=1,2,3"""

    def get(self, request):
        raw_ids = request.query_params.get("ids", "")
        try:
            ids = [int(i) for i in raw_ids.split(",") if i.strip()]
        except ValueError:
            return Response({"error": "ids must be integers"}, status=status.HTTP_400_BAD_REQUEST)
        if not ids:
            return Response({"error": "No ids provided"}, status=status.HTTP_400_BAD_REQUEST)

        jobs = IngestionJob.objects.prefetch_related("chunk_artifacts__chunk").filter(id__in=ids)
        serialized = IngestionJobSerializer(jobs, many=True).data

        statuses = [j["status"] for j in serialized]
        progresses = [j["progress"] for j in serialized]
        summary = {
            "total": len(ids),
            "pending": statuses.count("pending"),
            "processing": statuses.count("processing"),
            "completed": statuses.count("completed"),
            "failed": statuses.count("failed"),
            "overall_progress": round(sum(progresses) / len(progresses)) if progresses else 0,
            "all_terminal": all(s in ("completed", "failed") for s in statuses),
        }
        return Response({"jobs": serialized, "summary": summary})
