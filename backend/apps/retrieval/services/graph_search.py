from __future__ import annotations

from django.db.models import Q

from apps.knowledge.models import Claim, Entity, Relationship


def expand_graph(question: str, brain_id: str | None = None) -> dict:
    terms = [part.strip(" ?.!,:;").lower() for part in question.split() if len(part.strip()) > 2]
    entity_query = Q()
    for term in terms:
        entity_query |= Q(name__icontains=term) | Q(canonical_name__icontains=term) | Q(aliases__icontains=term)
    
    entity_qs = Entity.objects.filter(entity_query).distinct()
    if brain_id:
        entity_qs = entity_qs.filter(brain_id=brain_id)
        
    entities = list(entity_qs[:8]) if terms else []
    relationships = list(
        Relationship.objects.filter(Q(source_entity__in=entities) | Q(target_entity__in=entities))
        .select_related("source_entity", "target_entity")[:16]
    )
    claims = list(Claim.objects.filter(subject_entity__in=entities).select_related("source_chunk", "subject_entity")[:16])
    return {"entities": entities, "relationships": relationships, "claims": claims}

