from __future__ import annotations

from django.test import TestCase

from apps.agents.retrieval_agent import run_retrieval_state
from apps.core.models import Brain
from apps.core.utils import deterministic_embedding
from apps.documents.models import Chunk, Document
from apps.knowledge.models import Claim, ChunkEntityMention, Entity
from apps.knowledge.services.contradiction_detector import detect_contradictions_for_document
from apps.knowledge.services.retrieval_enrichment import enrich_document_knowledge, enrich_entity
from apps.retrieval.services.graph_search import expand_graph
from apps.retrieval.services.query_memory import persist_query_repair_memory


class RetrievalImprovementTests(TestCase):
    def setUp(self):
        self.brain = Brain.objects.create(name="Test Brain")

    def _create_document(self, title: str, text: str) -> tuple[Document, Chunk]:
        document = Document.objects.create(
            brain=self.brain,
            title=title,
            source_type=Document.SOURCE_TEXT,
            raw_text=text,
            llm_provider="",
            llm_model="",
            status=Document.STATUS_COMPLETED,
            quality_score=0.8,
        )
        chunk = Chunk.objects.create(
            document=document,
            text=text,
            summary=text[:200],
            chunk_index=0,
            token_count=180,
            embedding=deterministic_embedding(text),
            importance_score=0.5,
            quality_score=0.8,
            metadata={
                "embedding_provider": "deterministic",
                "embedding_model": "deterministic-1536",
            },
        )
        return document, chunk

    def test_entity_description_improves_graph_retrieval(self):
        document, chunk = self._create_document(
            "Automation Notes",
            "The billing exporter synchronizes invoices and exports subscription ledgers.",
        )
        entity = Entity.objects.create(
            brain=self.brain,
            name="LedgerFlow",
            canonical_name="LedgerFlow",
            entity_type="tool",
            description="LedgerFlow handles automated billing exports for subscription ledgers.",
            confidence=0.91,
            embedding=deterministic_embedding("LedgerFlow"),
        )
        ChunkEntityMention.objects.create(
            chunk=chunk,
            entity=entity,
            mention_text="LedgerFlow",
            confidence=0.9,
        )

        enrich_entity(entity)
        graph = expand_graph("Which tool handles billing exports?", brain_id=self.brain.id)

        self.assertEqual(graph["entities"][0].id, entity.id)
        self.assertIn("billing exports", graph["entities"][0].retrieval_text.lower())

    def test_low_confidence_repair_memory_is_reused_during_retrieval(self):
        document, preferred_chunk = self._create_document(
            "Pricing FAQ",
            "The Pro plan costs $49 per month and includes priority support.",
        )
        Chunk.objects.create(
            document=document,
            text="The Starter plan has onboarding help and community support.",
            summary="Starter plan support details.",
            chunk_index=1,
            token_count=120,
            embedding=deterministic_embedding("The Starter plan has onboarding help and community support."),
            importance_score=0.4,
            quality_score=0.7,
            metadata={
                "embedding_provider": "deterministic",
                "embedding_model": "deterministic-1536",
            },
        )

        persist_query_repair_memory(
            question="What is the pro plan price?",
            brain_id=self.brain.id,
            recommended_chunk_ids=[preferred_chunk.id],
            related_entity_ids=[],
            knowledge_gaps=[],
            last_answer_confidence=0.32,
        )

        state = run_retrieval_state(
            question="What is the pro plan price?",
            brain_id=self.brain.id,
        )

        self.assertIsNotNone(state["repair_memory"])
        self.assertEqual(state["repair_memory"].recommended_chunk_ids, [preferred_chunk.id])
        self.assertEqual(state["top_chunks"][0].id, preferred_chunk.id)

    def test_contradictions_are_flagged_and_surface_in_graph_context(self):
        document, chunk = self._create_document(
            "Pricing v1",
            "The Pro plan costs $49 per month.",
        )
        entity = Entity.objects.create(
            brain=self.brain,
            name="Pro Plan",
            canonical_name="Pro Plan",
            entity_type="plan",
            description="Paid plan for teams.",
            confidence=0.86,
            embedding=deterministic_embedding("Pro Plan"),
        )
        ChunkEntityMention.objects.create(
            chunk=chunk,
            entity=entity,
            mention_text="Pro Plan",
            confidence=0.9,
        )
        other_document, other_chunk = self._create_document(
            "Pricing v2",
            "The Pro plan costs $79 per month.",
        )
        ChunkEntityMention.objects.create(
            chunk=other_chunk,
            entity=entity,
            mention_text="Pro Plan",
            confidence=0.9,
        )
        Claim.objects.create(
            text="The Pro plan costs $49 per month.",
            source_chunk=chunk,
            subject_entity=entity,
            confidence=0.8,
        )
        Claim.objects.create(
            text="The Pro plan costs $79 per month.",
            source_chunk=other_chunk,
            subject_entity=entity,
            confidence=0.8,
        )

        enrich_document_knowledge(document)
        enrich_document_knowledge(other_document)
        detect_contradictions_for_document(document)
        graph = expand_graph("What does the Pro plan cost?", brain_id=self.brain.id)

        self.assertTrue(any(claim.contradiction_flag for claim in graph["claims"]))
        self.assertTrue(graph["contradiction_warnings"])
