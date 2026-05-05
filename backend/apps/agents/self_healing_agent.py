from __future__ import annotations

from typing import TypedDict

from django.utils import timezone
from langgraph.graph import END, START, StateGraph

from apps.self_healing.models import SelfHealingTask
from apps.self_healing.services.contradiction_repair import review_contradiction
from apps.self_healing.services.duplicate_entity_repair import repair_duplicate_entities
from apps.self_healing.services.low_confidence_repair import repair_low_confidence_answer
from apps.self_healing.services.missing_definition_repair import repair_missing_definition


class RepairState(TypedDict, total=False):
    task: SelfHealingTask
    route: str
    result: dict


def start_task(state: RepairState) -> RepairState:
    task = state["task"]
    task.status = SelfHealingTask.STATUS_RUNNING
    task.save(update_fields=["status", "updated_at"])
    return {"task": task}


def route_task(state: RepairState) -> RepairState:
    return {"route": state["task"].task_type}


def route_label(state: RepairState) -> str:
    task_type = state["route"]
    if task_type == SelfHealingTask.TYPE_DUPLICATE_ENTITY:
        return "duplicate_entity"
    if task_type == SelfHealingTask.TYPE_MISSING_DEFINITION:
        return "missing_definition"
    if task_type == SelfHealingTask.TYPE_LOW_CONFIDENCE_ANSWER:
        return "low_confidence_answer"
    if task_type == SelfHealingTask.TYPE_CONTRADICTION:
        return "contradiction"
    return "fallback"


def run_duplicate_entity_repair(state: RepairState) -> RepairState:
    task = state["task"]
    return {
        "result": repair_duplicate_entities(
            candidate_entity_ids=task.payload.get("candidate_entity_ids", []),
            suggested_canonical_name=task.payload.get("suggested_canonical_name", ""),
        )
    }


def run_missing_definition_repair(state: RepairState) -> RepairState:
    task = state["task"]
    document = task.related_document
    return {
        "result": repair_missing_definition(
            entity_id=task.payload["entity_id"],
            llm_provider=document.llm_provider if document else None,
            llm_model=document.llm_model if document else None,
        )
    }


def run_low_confidence_answer_repair(state: RepairState) -> RepairState:
    return {"result": repair_low_confidence_answer(question=state["task"].payload["question"])}


def run_contradiction_review(state: RepairState) -> RepairState:
    return {"result": review_contradiction(state["task"].payload)}


def run_fallback(state: RepairState) -> RepairState:
    return {"result": {"status": "ignored", "message": "No repair runner registered."}}


def finalize_task(state: RepairState) -> RepairState:
    task = state["task"]
    task.result = state.get("result", {})
    task.status = SelfHealingTask.STATUS_COMPLETED
    task.completed_at = timezone.now()
    task.error_message = ""
    task.save(update_fields=["status", "result", "completed_at", "error_message", "updated_at"])
    return {"task": task}


def build_self_healing_graph():
    builder = StateGraph(RepairState)
    builder.add_node("start_task", start_task)
    builder.add_node("route_task", route_task)
    builder.add_node("duplicate_entity", run_duplicate_entity_repair)
    builder.add_node("missing_definition", run_missing_definition_repair)
    builder.add_node("low_confidence_answer", run_low_confidence_answer_repair)
    builder.add_node("contradiction", run_contradiction_review)
    builder.add_node("fallback", run_fallback)
    builder.add_node("finalize_task", finalize_task)
    builder.add_edge(START, "start_task")
    builder.add_edge("start_task", "route_task")
    builder.add_conditional_edges(
        "route_task",
        route_label,
        {
            "duplicate_entity": "duplicate_entity",
            "missing_definition": "missing_definition",
            "low_confidence_answer": "low_confidence_answer",
            "contradiction": "contradiction",
            "fallback": "fallback",
        },
    )
    builder.add_edge("duplicate_entity", "finalize_task")
    builder.add_edge("missing_definition", "finalize_task")
    builder.add_edge("low_confidence_answer", "finalize_task")
    builder.add_edge("contradiction", "finalize_task")
    builder.add_edge("fallback", "finalize_task")
    builder.add_edge("finalize_task", END)
    return builder.compile()


SELF_HEALING_GRAPH = build_self_healing_graph()


def run_task(task: SelfHealingTask) -> SelfHealingTask:
    try:
        SELF_HEALING_GRAPH.invoke({"task": task})
        task.refresh_from_db()
    except Exception as exc:
        task.status = SelfHealingTask.STATUS_FAILED
        task.error_message = str(exc)
        task.save(update_fields=["status", "error_message", "updated_at"])
    return task


__all__ = ["run_task", "SELF_HEALING_GRAPH", "build_self_healing_graph"]
