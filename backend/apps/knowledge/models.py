from pgvector.django import VectorField
from django.db import models

from apps.documents.models import Chunk, Document
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
    start_char = models.IntegerField(null=True, blank=True)
    end_char = models.IntegerField(null=True, blank=True)


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


class EvidenceSpan(models.Model):
    LOCATOR_PDF_PAGE_BBOX = "pdf_page_bbox"
    LOCATOR_TEXT_CHAR_RANGE = "text_char_range"
    LOCATOR_DOCX_PARAGRAPH_RANGE = "docx_paragraph_range"
    LOCATOR_PPTX_SLIDE_TEXT_RANGE = "pptx_slide_text_range"
    LOCATOR_SHEET_CELL_RANGE = "sheet_cell_range"
    LOCATOR_HTML_DOM_TEXT_RANGE = "html_dom_text_range"
    LOCATOR_CHOICES = [
        (LOCATOR_PDF_PAGE_BBOX, "PDF page bounding boxes"),
        (LOCATOR_TEXT_CHAR_RANGE, "Text character range"),
        (LOCATOR_DOCX_PARAGRAPH_RANGE, "DOCX paragraph range"),
        (LOCATOR_PPTX_SLIDE_TEXT_RANGE, "PPTX slide text range"),
        (LOCATOR_SHEET_CELL_RANGE, "Sheet cell range"),
        (LOCATOR_HTML_DOM_TEXT_RANGE, "HTML text range"),
    ]

    CREATED_FROM_CHAT = "chat"
    CREATED_FROM_REVIEW = "review"
    CREATED_FROM_MANUAL = "manual"
    CREATED_FROM_CHOICES = [
        (CREATED_FROM_CHAT, "Chat"),
        (CREATED_FROM_REVIEW, "Review"),
        (CREATED_FROM_MANUAL, "Manual"),
    ]

    REVIEW_UNREVIEWED = "unreviewed"
    REVIEW_VERIFIED = "verified"
    REVIEW_REJECTED = "rejected"
    REVIEW_NEEDS_REVIEW = "needs_review"
    REVIEW_CHOICES = [
        (REVIEW_UNREVIEWED, "Unreviewed"),
        (REVIEW_VERIFIED, "Verified"),
        (REVIEW_REJECTED, "Rejected"),
        (REVIEW_NEEDS_REVIEW, "Needs review"),
    ]

    document = models.ForeignKey(Document, on_delete=models.CASCADE, related_name="evidence_spans")
    chunk = models.ForeignKey(Chunk, on_delete=models.CASCADE, related_name="evidence_spans")
    chat_message = models.ForeignKey(
        "ChatMessage",
        on_delete=models.SET_NULL,
        related_name="evidence_spans",
        null=True,
        blank=True,
    )
    quote_text = models.TextField()
    span_start_char = models.IntegerField()
    span_end_char = models.IntegerField()
    primary_locator_type = models.CharField(max_length=64, choices=LOCATOR_CHOICES)
    locator_payload = models.JSONField(default=dict, blank=True)
    created_from = models.CharField(max_length=32, choices=CREATED_FROM_CHOICES, default=CREATED_FROM_CHAT)
    review_status = models.CharField(max_length=32, choices=REVIEW_CHOICES, default=REVIEW_UNREVIEWED)
    notes = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["document", "chunk"]),
            models.Index(fields=["chat_message", "created_at"]),
            models.Index(fields=["primary_locator_type", "review_status"]),
        ]
