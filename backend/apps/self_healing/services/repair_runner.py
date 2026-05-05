from __future__ import annotations

from apps.agents.self_healing_agent import run_task as run_self_healing_graph
from apps.self_healing.models import SelfHealingTask


def run_task(task: SelfHealingTask) -> SelfHealingTask:
    return run_self_healing_graph(task)

