from __future__ import annotations

import json

from django.http import StreamingHttpResponse
from rest_framework import generics
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.agents.retrieval_agent import answer_question, stream_question_answer
from apps.knowledge.models import ChatSession
from apps.retrieval.serializers import ChatQuerySerializer, ChatSessionSerializer


def _sse_event(payload: dict) -> str:
    return f"data: {json.dumps(payload)}\n\n"


class ChatQueryView(APIView):
    def post(self, request):
        serializer = ChatQuerySerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        payload = answer_question(**serializer.validated_data)
        return Response(payload)


class ChatQueryStreamView(APIView):
    def post(self, request):
        serializer = ChatQuerySerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        validated = serializer.validated_data

        def event_stream():
            yield _sse_event({"type": "status", "message": "retrieval_started"})
            try:
                for event in stream_question_answer(**validated):
                    yield _sse_event(event)
            except Exception as exc:
                yield _sse_event({"type": "error", "message": str(exc)})

        response = StreamingHttpResponse(event_stream(), content_type="text/event-stream")
        response["Cache-Control"] = "no-cache"
        response["X-Accel-Buffering"] = "no"
        return response


class ChatSessionListView(generics.ListAPIView):
    serializer_class = ChatSessionSerializer

    def get_queryset(self):
        brain_id = self.request.query_params.get("brain_id")
        if brain_id:
            return ChatSession.objects.filter(brain_id=brain_id)
        return ChatSession.objects.all()


class ChatSessionDetailView(generics.RetrieveAPIView):
    queryset = ChatSession.objects.all()
    serializer_class = ChatSessionSerializer
