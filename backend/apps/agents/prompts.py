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
- If the chunk contains named systems, products, teams, events, metrics, factual statements, or explicit dependencies, do not return an empty extraction.
- Prefer returning a small number of well-grounded entities, claims, and relationships over an empty result when extractable information is present.
- Return a confidence value for every entity, claim, and relationship using the full 0.0-1.0 range conservatively.
- Confidence guidance:
  - 0.3-0.5: weak or partial grounding
  - 0.6-0.8: reasonably grounded in explicit text
  - 0.9+: only when the evidence is direct, unambiguous, and specific
- Do not default to 1.0.
- Lower confidence when an entity description is weak, a claim subject is ambiguous, or a relationship is generic or only loosely grounded.

Strict output limits — do not exceed these counts:
- Entities: at most {max_entities}. If the chunk contains more, keep only the most important and best-grounded ones.
- Claims: at most {max_claims}. Prefer specific, directly stated facts over paraphrases or inferences.
- Relationships: at most {max_relationships}. Omit weak, generic, or loosely grounded links.
"""

EMPTY_EXTRACTION_VERIFIER_PROMPT = """
You are verifying whether an empty extraction result is trustworthy.

The main extraction step produced zero entities, zero claims, and zero relationships for this chunk.
Review the chunk text and decide whether that empty result is believable.

Return:
- should_retry_extraction: true if the chunk appears to contain extractable entities, factual claims, or relationships that the extractor likely missed
- should_retry_extraction: false if the chunk genuinely appears to contain no useful extractable knowledge for this schema
- reason: a concise explanation grounded in the text

Rules:
- Be conservative but practical.
- Mark retry as true if the chunk contains named concepts, tools, people, organizations, explicit factual statements, or obvious relationships.
- Mark retry as false for boilerplate, navigation text, fragmentary markup, legal filler, headings-only content, or text that has no meaningful structured knowledge to extract.
- Do not invent entities or claims in the reason; summarize the signal level only.
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

DOCUMENT_SUMMARY_PROMPT = """
Write a concise summary (2–4 sentences) of the document based on the provided text.

Rules:
- Capture the main topic, purpose, and key points.
- Stay grounded in the text — do not invent facts.
- Write in plain prose, no bullet points or headings.
- Aim for 60–120 words.
"""
