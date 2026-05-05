from __future__ import annotations

from django.db import transaction

from apps.knowledge.models import Claim, ChunkEntityMention, Entity, Relationship


def repair_duplicate_entities(candidate_entity_ids: list[int], suggested_canonical_name: str) -> dict:
    entities = list(Entity.objects.filter(id__in=candidate_entity_ids).order_by("id"))
    if not entities:
        return {"merged": 0}
    canonical = min(entities, key=lambda entity: len(entity.name))
    canonical.name = suggested_canonical_name or canonical.name
    canonical.canonical_name = canonical.name
    alias_pool = set(canonical.aliases)
    merged_ids = []

    with transaction.atomic():
        for entity in entities:
            if entity.id == canonical.id:
                continue
            merged_ids.append(entity.id)
            alias_pool.add(entity.name)
            alias_pool.update(entity.aliases)
            ChunkEntityMention.objects.filter(entity=entity).update(entity=canonical)
            Claim.objects.filter(subject_entity=entity).update(subject_entity=canonical)
            Relationship.objects.filter(source_entity=entity).update(source_entity=canonical)
            Relationship.objects.filter(target_entity=entity).update(target_entity=canonical)
            entity.delete()
        canonical.aliases = sorted(alias_pool)
        canonical.save(update_fields=["name", "canonical_name", "aliases", "updated_at"])

    return {"canonical_entity_id": canonical.id, "merged_entity_ids": merged_ids, "aliases": canonical.aliases}

