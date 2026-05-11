from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field


class ExtractedEntity(BaseModel):
    name: str = Field(min_length=1)
    type: str = Field(default="concept")
    description: str = Field(default="")
    confidence: float = Field(default=0.7, ge=0.0, le=1.0)
    aliases: list[str] = Field(default_factory=list)


class EntityExtractionResponse(BaseModel):
    entities: list[ExtractedEntity] = Field(default_factory=list)


class ExtractedClaim(BaseModel):
    text: str = Field(min_length=1)
    subject: str | None = None
    confidence: float = Field(default=0.7, ge=0.0, le=1.0)


class ClaimExtractionResponse(BaseModel):
    claims: list[ExtractedClaim] = Field(default_factory=list)


class ExtractedRelationship(BaseModel):
    source: str
    target: str
    type: str = Field(default="related_to")
    confidence: float = Field(default=0.65, ge=0.0, le=1.0)


class RelationshipExtractionResponse(BaseModel):
    relationships: list[ExtractedRelationship] = Field(default_factory=list)


class BundledExtractionResponse(BaseModel):
    entities: list[ExtractedEntity] = Field(default_factory=list)
    claims: list[ExtractedClaim] = Field(default_factory=list)
    relationships: list[ExtractedRelationship] = Field(default_factory=list)
    content_type: Literal[
        "definition", "example", "argument", "data_statistics", "procedure", "reference", "narrative"
    ] = Field(default="narrative")
    certainty_level: float = Field(
        default=0.7,
        ge=0.0,
        le=1.0,
        description="0=highly hedged/speculative language, 1=direct factual assertion",
    )


class EmptyExtractionVerificationResponse(BaseModel):
    should_retry_extraction: bool = False
    reason: str = Field(min_length=1)


class AnswerCitation(BaseModel):
    chunk_id: int
    quote_text: str = Field(min_length=1)


class AnswerSection(BaseModel):
    content: str = Field(min_length=1)
    chunk_ids: list[int] = Field(default_factory=list)


class AnswerResponse(BaseModel):
    answer_markdown: str
    grounded_citations: list[AnswerCitation] = Field(default_factory=list)
    answer_sections: list[AnswerSection] = Field(default_factory=list)
    confidence_score: float = Field(ge=0.0, le=1.0)
    source_chunk_ids: list[int] = Field(default_factory=list)
    related_entity_ids: list[int] = Field(default_factory=list)
    knowledge_gaps: list[str] = Field(default_factory=list)
    should_create_self_healing_task: bool = False


class MissingDefinitionResponse(BaseModel):
    definition: str
    confidence: float = Field(ge=0.0, le=1.0)
    evidence_chunk_ids: list[int] = Field(default_factory=list)


class DocumentSummaryResponse(BaseModel):
    summary: str = Field(min_length=1)
