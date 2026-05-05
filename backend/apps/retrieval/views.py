from rest_framework import generics
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.agents.retrieval_agent import answer_question
from apps.knowledge.models import ChatSession
from apps.retrieval.serializers import ChatQuerySerializer, ChatSessionSerializer


class ChatQueryView(APIView):
    def post(self, request):
        serializer = ChatQuerySerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        payload = answer_question(**serializer.validated_data)
        return Response(payload)


class ChatSessionListView(generics.ListAPIView):
    queryset = ChatSession.objects.all()
    serializer_class = ChatSessionSerializer


class ChatSessionDetailView(generics.RetrieveAPIView):
    queryset = ChatSession.objects.all()
    serializer_class = ChatSessionSerializer
