from __future__ import annotations

from apps.core.utils import normalise_query_text
from apps.knowledge.models import ChatMessage, ChatSession


def build_session_context(session_id: int | None) -> dict[str, object]:
    if not session_id:
        return {
            "summary": "",
            "recent_questions": [],
            "recent_answers": [],
            "recent_gaps": [],
            "referenced_entities": [],
        }

    session = ChatSession.objects.filter(id=session_id).prefetch_related("messages").first()
    if session is None:
        return {
            "summary": "",
            "recent_questions": [],
            "recent_answers": [],
            "recent_gaps": [],
            "referenced_entities": [],
        }

    messages = list(session.messages.order_by("-created_at")[:6])[::-1]
    recent_questions = [message.content for message in messages if message.role == ChatMessage.ROLE_USER][-3:]
    recent_answers = [message.content for message in messages if message.role == ChatMessage.ROLE_ASSISTANT][-2:]

    recent_gaps: list[str] = []
    referenced_entities: list[str] = []
    for message in messages:
        if message.role != ChatMessage.ROLE_ASSISTANT:
            continue
        gaps = message.metadata.get("knowledge_gaps", [])
        if isinstance(gaps, list):
            recent_gaps.extend(gap for gap in gaps if isinstance(gap, str) and gap not in recent_gaps)
        entities = message.metadata.get("related_entities", [])
        if isinstance(entities, list):
            for entity in entities:
                if (
                    isinstance(entity, dict)
                    and isinstance(entity.get("name"), str)
                    and entity["name"] not in referenced_entities
                ):
                    referenced_entities.append(entity["name"])

    summary = session.summary.strip()
    if not summary:
        summary_parts: list[str] = []
        if recent_questions:
            summary_parts.append("Recent questions: " + " | ".join(recent_questions[-2:]))
        if referenced_entities:
            summary_parts.append("Referenced entities: " + ", ".join(referenced_entities[:6]))
        if recent_gaps:
            summary_parts.append("Open gaps: " + "; ".join(recent_gaps[:3]))
        summary = "\n".join(summary_parts)

    return {
        "summary": summary,
        "recent_questions": recent_questions,
        "recent_answers": recent_answers,
        "recent_gaps": recent_gaps,
        "referenced_entities": referenced_entities,
    }


def build_contextual_question(question: str, session_context: dict[str, object]) -> str:
    summary = str(session_context.get("summary") or "").strip()
    recent_questions = [item for item in session_context.get("recent_questions", []) if isinstance(item, str)]
    if not summary and not recent_questions:
        return question

    normalized = normalise_query_text(question)
    follow_up_starts = (
        "what about",
        "how about",
        "and ",
        "it ",
        "they ",
        "them ",
        "those ",
        "that ",
        "when ",
        "where ",
        "why ",
        "how much ",
    )
    if normalized and len(normalized.split()) > 4 and not question.lower().startswith(follow_up_starts):
        return question

    lines: list[str] = []
    if summary:
        lines.append(summary)
    elif recent_questions:
        lines.append("Conversation topic: " + " | ".join(recent_questions[-2:]))
    lines.append(f"Follow-up question: {question}")
    return "\n".join(lines)


def refresh_session_summary(session: ChatSession) -> str:
    context = build_session_context(session.id)
    summary = str(context.get("summary") or "").strip()
    session.summary = summary
    session.save(update_fields=["summary"])
    return summary
