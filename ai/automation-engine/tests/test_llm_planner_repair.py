"""Validation-aware Repair: when Tool Contract validation rejects the
LLM Planner's own output, app.main._run_planned_task() hands the LLM its
previous tool/arguments and the exact validation error, and lets it
regenerate exactly once (LLMPlanner.replan_with_error()). Repaired
arguments are re-validated before Executor runs, same as the first
attempt. All of these tests mock the LLM (no real Ollama call) — the real
model is exercised separately as an E2E check."""

from unittest.mock import patch

from app.llm import LLMProvider
from app.main import run_llm_task
from app.tools import search_jobs as real_search_jobs


class ScriptedLLM(LLMProvider):
    """Returns each response in `responses` in order, one per call — lets
    a test control exactly what the "initial attempt" and "Repair
    attempt" each produce, which a fixed-response FakeLLM can't do."""

    def __init__(self, responses: list[str]):
        self.responses = list(responses)
        self.prompts: list[str] = []

    def generate(self, prompt: str) -> str:
        self.prompts.append(prompt)
        return self.responses.pop(0)


# --- invalid -> Repair -> valid -> Executor -> success --------------------


def test_invalid_arguments_are_repaired_by_the_llm_and_then_succeed():
    scripted_llm = ScriptedLLM(
        [
            # Initial attempt: an unknown "optional" key, same shape as
            # the real hallucination this Repair feature was built to
            # handle (spec section 5/25).
            '{"tool_name": "job_search_tool", '
            '"arguments": {"keyword": "Python", "optional": ["location"]}}',
            # Repair attempt: the same tool, now valid.
            '{"tool_name": "job_search_tool", "arguments": {"keyword": "Python"}}',
        ]
    )

    with patch("app.llm_planner.OllamaProvider", return_value=scripted_llm), patch(
        "app.registry.search_jobs", autospec=True, side_effect=real_search_jobs
    ) as spy:
        task, routed_tool = run_llm_task("Python案件を探して")

    # The second prompt (the Repair one) must actually carry the previous
    # attempt's error, not just be a second identical planning attempt.
    assert len(scripted_llm.prompts) == 2
    assert "unknown argument(s): optional" in scripted_llm.prompts[1]
    assert "job_search_tool" in scripted_llm.prompts[1]

    spy.assert_called_once_with(keyword="Python")
    assert routed_tool == "job_search_tool"
    assert task.tool == "job_search_tool"
    assert task.parameters == {"keyword": "Python"}
    assert task.status == "success"
    assert task.retry_count == 1


# --- invalid -> Repair -> still invalid -> failure, Executor never called -


def test_repair_that_is_still_invalid_fails_without_reaching_the_tool():
    scripted_llm = ScriptedLLM(
        [
            '{"tool_name": "engineer_match_tool", "arguments": {}}',
            # Repair attempt still omits the required job_id.
            '{"tool_name": "engineer_match_tool", "arguments": {"jobid": "JOB001"}}',
        ]
    )

    with patch("app.llm_planner.OllamaProvider", return_value=scripted_llm), patch(
        "app.registry.match_engineers", autospec=True
    ) as spy:
        task, routed_tool = run_llm_task("要員を探して")

    spy.assert_not_called()
    assert task.status == "error"
    # The Repair attempt introduced a new mistake ("jobid" instead of
    # "job_id") rather than fixing the original one — still rejected, this
    # time as an unknown argument.
    assert "jobid" in task.error
    assert task.retry_count == 1


# --- Repair happens at most once: a third scripted response must never be
# consumed --------------------------------------------------------------


def test_repair_is_attempted_at_most_once():
    scripted_llm = ScriptedLLM(
        [
            '{"tool_name": "engineer_match_tool", "arguments": {}}',
            '{"tool_name": "engineer_match_tool", "arguments": {}}',
            # A third response that would only be consumed by a second
            # (forbidden) Repair round — never returned to LLMPlanner.
            '{"tool_name": "engineer_match_tool", "arguments": {"job_id": "JOB001"}}',
        ]
    )

    with patch("app.llm_planner.OllamaProvider", return_value=scripted_llm), patch(
        "app.registry.match_engineers", autospec=True
    ) as spy:
        task, routed_tool = run_llm_task("要員を探して")

    assert len(scripted_llm.prompts) == 2  # initial + exactly one Repair
    assert scripted_llm.responses == [
        '{"tool_name": "engineer_match_tool", "arguments": {"job_id": "JOB001"}}'
    ]  # the third response was never consumed
    spy.assert_not_called()
    assert task.status == "error"
    assert task.retry_count == 1


# --- a valid initial response never triggers Repair at all ---------------


def test_a_valid_initial_response_never_triggers_repair():
    scripted_llm = ScriptedLLM(
        ['{"tool_name": "current_time_tool", "arguments": {}}']
    )

    with patch("app.llm_planner.OllamaProvider", return_value=scripted_llm), patch(
        "app.registry.get_current_time", autospec=True
    ) as spy:
        spy.return_value = "2026-01-01 00:00:00"
        task, routed_tool = run_llm_task("今の時刻を教えて")

    assert len(scripted_llm.prompts) == 1  # no Repair prompt was ever built
    spy.assert_called_once_with()
    assert task.status == "success"
    assert task.retry_count == 0


# --- unknown tool_name (not a validation failure) still uses the existing
# AIRepair tool-name fallback, unchanged ----------------------------------


def test_a_hallucinated_tool_name_still_uses_the_existing_fallback_repair():
    scripted_llm = ScriptedLLM(
        [
            '{"tool_name": "foo_bar_tool", "arguments": {}}',
            # Never consumed: LLMPlanner.plan() already turns an unknown
            # tool_name into tool="unknown" before _run_planned_task() can
            # even see a validation_error, so the old AIRepair fallback
            # (not a second LLM call) handles this case.
            '{"tool_name": "job_search_tool", "arguments": {}}',
        ]
    )

    with patch("app.llm_planner.OllamaProvider", return_value=scripted_llm):
        task, routed_tool = run_llm_task("何かして")

    assert len(scripted_llm.prompts) == 1  # no replan_with_error() call
    assert task.tool == "unknown"
    assert routed_tool == "job_search_tool"
    assert task.status == "success"
    assert task.retry_count == 1
