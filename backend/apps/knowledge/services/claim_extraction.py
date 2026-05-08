from __future__ import annotations

import re

from langchain_core.prompts import ChatPromptTemplate

from apps.agents.llm import get_chat_model
from apps.agents.prompts import CLAIM_EXTRACTION_PROMPT
from apps.agents.schemas import ClaimExtractionResponse
from apps.documents.models import Chunk
from apps.knowledge.models import Claim


def _llm_claims(chunk: Chunk, llm_provider: str | None = None, llm_model: str | None = None) -> list[dict]:
    model = get_chat_model(llm_provider, llm_model)
    if model is None:
        return []
    prompt = ChatPromptTemplate.from_messages(
        [
            ("system", CLAIM_EXTRACTION_PROMPT),
            ("human", "Chunk text:\n{chunk_text}"),
        ]
    )
    try:
        chain = prompt | model.with_structured_output(ClaimExtractionResponse)
        response = chain.invoke({"chunk_text": chunk.text})
        if response is None:
            return []
        return [claim.model_dump() for claim in response.claims]
    except Exception:
        return []


def extract_claims_for_chunk(
    chunk: Chunk,
    llm_provider: str | None = None,
    llm_model: str | None = None,
) -> list[Claim]:
    claims: list[Claim] = []
    subject_entity = chunk.entity_mentions.select_related("entity").first()
    payloads = _llm_claims(chunk, llm_provider, llm_model)
    if not payloads:
        sentences = re.split(r"(?<=[.!?])\s+", chunk.text)
        payloads = [
            {
                "text": sentence.strip(),
                "subject": subject_entity.entity.name if subject_entity else None,
                "confidence": 0.68,
            }
            for sentence in sentences[:8]
            if len(sentence.strip()) >= 30
        ]

    for payload in payloads:
        text = payload["text"].strip()
        if len(text) < 30:
            continue
        claim, _ = Claim.objects.get_or_create(
            source_chunk=chunk,
            text=text,
            defaults={
                "subject_entity": subject_entity.entity if subject_entity else None,
                "confidence": payload.get("confidence", 0.68),
            },
        )
        claims.append(claim)
    return claims
