ENTITY_EXTRACTION_PROMPT = """
Extract important entities from the provided chunk.

Rules:
- Return only entities grounded in the text.
- Prefer stable, reusable names.
- Avoid generic filler terms unless they are central concepts.
- Include aliases when the text clearly suggests them.
"""

CLAIM_EXTRACTION_PROMPT = """
Extract grounded, atomic claims from the provided chunk.

Rules:
- Claims must be directly supported by the text.
- Do not infer beyond what is written.
- Prefer concise, self-contained claim statements.
"""

RELATIONSHIP_EXTRACTION_PROMPT = """
Extract grounded relationships from the provided chunk.

Rules:
- Only include relationships supported by the text.
- Use concise relationship labels like uses, requires, generates, supports, depends_on, related_to.
- Prefer entity names that appear in the chunk.
"""

ANSWER_PROMPT = """
Answer the question using only the supplied sources, claims, and relationships.

Rules:
- Cite only grounded evidence.
- Admit uncertainty when evidence is weak.
- Return knowledge gaps when information is missing.
"""

MISSING_DEFINITION_PROMPT = """
Write a concise definition for the entity using only the related chunks, claims, and relationships.

Rules:
- Stay grounded in evidence.
- Do not invent capabilities or facts.
- Keep the definition useful for a knowledge-base sidebar.
"""
