from pgvector.django import VectorField
from django.db import models

from apps.documents.models import Chunk
from apps.core.models import Brain


class Entity(models.Model):
    brain = models.ForeignKey(Brain, on_delete=models.CASCADE, related_name="entities", null=True)
    name = models.CharField(max_length=255)
    canonical_name = models.CharField(max_length=255, blank=True)
    entity_type = models.CharField(max_length=100)
    description = models.TextField(blank=True)
    confidence = models.FloatField(default=0)
    embedding = VectorField(dimensions=1536, null=True, blank=True)
    aliases = models.JSONField(default=list, blank=True)
    retrieval_text = models.TextField(blank=True)
    mention_count = models.PositiveIntegerField(default=0)
    source_document_count = models.PositiveIntegerField(default=0)
    top_evidence_chunk_ids = models.JSONField(default=list, blank=True)
    last_enriched_at = models.DateTimeField(null=True, blank=True)
    metadata = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        indexes = [models.Index(fields=["name"])]
        ordering = ["name"]


class ChunkEntityMention(models.Model):
    chunk = models.ForeignKey(Chunk, on_delete=models.CASCADE, related_name="entity_mentions")
    entity = models.ForeignKey(Entity, on_delete=models.CASCADE, related_name="mentions")
    mention_text = models.CharField(max_length=255)
    confidence = models.FloatField(default=0)


class Claim(models.Model):
    VERIFIED_UNVERIFIED = "unverified"
    REVIEW_CLEAR = "clear"
    REVIEW_CONTRADICTION = "contradiction"
    REVIEW_ACTIVE = "active"
    REVIEW_SUPERSEDED = "superseded"
    REVIEW_AUTHORITATIVE = "authoritative"
    REVIEW_NEEDS_REVIEW = "needs_review"

    text = models.TextField()
    source_chunk = models.ForeignKey(Chunk, on_delete=models.CASCADE, related_name="claims")
    subject_entity = models.ForeignKey(Entity, null=True, blank=True, on_delete=models.SET_NULL, related_name="claims")
    confidence = models.FloatField(default=0)
    verified_status = models.CharField(max_length=50, default=VERIFIED_UNVERIFIED)
    contradiction_flag = models.BooleanField(default=False)
    contradiction_review_state = models.CharField(
        max_length=50,
        default=REVIEW_ACTIVE,
    )
    subject_key = models.CharField(max_length=255, blank=True)
    metadata = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]


class Relationship(models.Model):
    source_entity = models.ForeignKey(Entity, related_name="outgoing_relationships", on_delete=models.CASCADE)
    target_entity = models.ForeignKey(Entity, related_name="incoming_relationships", on_delete=models.CASCADE)
    relationship_type = models.CharField(max_length=100)
    normalized_type = models.CharField(max_length=100, blank=True)
    evidence_chunk = models.ForeignKey(Chunk, on_delete=models.CASCADE, related_name="relationships")
    confidence = models.FloatField(default=0)
    metadata = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        indexes = [models.Index(fields=["relationship_type"])]
        ordering = ["-created_at"]


class ChatSession(models.Model):
    brain = models.ForeignKey(Brain, on_delete=models.CASCADE, related_name="chat_sessions", null=True)
    title = models.CharField(max_length=255, blank=True)
    summary = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]


class ChatMessage(models.Model):
    ROLE_USER = "user"
    ROLE_ASSISTANT = "assistant"

    session = models.ForeignKey(ChatSession, on_delete=models.CASCADE, related_name="messages")
    role = models.CharField(max_length=50)
    content = models.TextField()
    confidence_score = models.FloatField(null=True, blank=True)
    sources = models.JSONField(default=list, blank=True)
    metadata = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["created_at"]
