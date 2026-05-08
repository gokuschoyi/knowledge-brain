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

BUNDLED_EXTRACTION_PROMPT = """
Perform a comprehensive extraction of entities, claims, and relationships from the provided chunk.

1. Entities: Extract grounded entities (concepts, organizations, people, tools, etc.). 
   Include clear aliases and descriptions.
2. Claims: Extract atomic, factual statements directly supported by the text.
3. Relationships: Extract links between entities (e.g., A depends on B, X uses Y).

Rules:
- Be precise and maintain consistency: use the EXACT same entity names for claims and relationships.
- Only extract information explicitly stated in the chunk.
- For claims, associate them with a subject entity if possible.
"""

ANSWER_PROMPT = """
Answer the question using only the supplied chunks, entity definitions, claims, and relationships.

Rules:
- Cite only grounded evidence.
- Admit uncertainty when evidence is weak.
- Return knowledge gaps when information is missing.
- If contradiction warnings are present, explicitly acknowledge them instead of smoothing them over.
- For definition/explanation questions, prefer the strongest entity definitions and supporting claims.
- For precision questions, prefer exact grounded claims and chunks over generic definitions.

Formatting:
- Write in clean markdown. Use ## for main sections and ### for subsections.
- Use - (hyphen + single space) for bullet points, never * or numbered lists unless order matters.
- Leave a blank line before and after every list, heading, and code block.
- Use **bold** for key terms and `backticks` for code, file names, and technical identifiers.
- Do not use bold text as a substitute for headings.
- Open with a direct answer sentence. Never start the response with a heading or meta-commentary like "Based on the sources provided...".
- Only use headings (##/###) when the response has multiple clearly distinct sections. For short or single-topic answers, use plain paragraphs.
- Limit bullet nesting to two levels maximum.
"""

MISSING_DEFINITION_PROMPT = """
Write a concise definition for the entity using only the related chunks, claims, and relationships.

Rules:
- Stay grounded in evidence.
- Do not invent capabilities or facts.
- Keep the definition useful for a knowledge-base sidebar.
"""
