"""E2E-style tests (mocked LLM, no real Ollama call) proving the critical
boundary from the spec: arguments that fail Tool Contract validation never
reach ToolExecutor / the underlying Tool function, while valid arguments
for the same Tool do reach it and the pipeline completes with success."""

from unittest.mock import patch

from app.llm import LLMProvider
from app.main import run_llm_task
from app.tools import match_engineers as real_match_engineers


class FakeLLM(LLMProvider):
    def __init__(self, response: str):
        self.response = response

    def generate(self, prompt: str) -> str:
        return self.response


# --- valid arguments (real argument-carrying Tool: engineer_match_tool,
# job_id: str, required) reach the Tool and it actually runs -------------


def test_valid_arguments_reach_the_tool_and_it_actually_runs():
    fake_llm = FakeLLM('{"tool_name": "engineer_match_tool", "arguments": {"job_id": "JOB001"}}')

    # autospec=True: the mock keeps match_engineers's real signature (so
    # build_tool_contracts()' inspect.signature() still derives the true
    # contract, not a generic *args/**kwargs one), while side_effect still
    # runs the real function so the pipeline actually completes.
    with patch("app.llm_planner.OllamaProvider", return_value=fake_llm), patch(
        "app.registry.match_engineers", autospec=True, side_effect=real_match_engineers
    ) as spy:
        task, routed_tool = run_llm_task("JOB001に合う要員を探して")

    spy.assert_called_once_with(job_id="JOB001")
    assert routed_tool == "engineer_match_tool"
    assert task.status == "success"
    assert task.retry_count == 0


# --- missing required argument: validation fails, Tool is never called --


def test_missing_required_argument_never_reaches_the_tool():
    fake_llm = FakeLLM('{"tool_name": "engineer_match_tool", "arguments": {}}')

    with patch("app.llm_planner.OllamaProvider", return_value=fake_llm), patch(
        "app.registry.match_engineers", autospec=True
    ) as spy:
        task, routed_tool = run_llm_task("要員を探して")

    spy.assert_not_called()
    assert routed_tool == "engineer_match_tool"
    assert task.status == "error"
    assert "job_id" in task.error
    # Repair has no rule for a known tool with invalid arguments (spec: no
    # AI Repair auto-fix this round) — same tool, same bad arguments, one
    # retry, still fails.
    assert task.retry_count == 1


# --- unknown/extra argument: validation fails, Tool is never called -----


def test_unknown_argument_never_reaches_the_tool():
    fake_llm = FakeLLM(
        '{"tool_name": "engineer_match_tool", '
        '"arguments": {"job_id": "JOB001", "unexpected_field": "value"}}'
    )

    with patch("app.llm_planner.OllamaProvider", return_value=fake_llm), patch(
        "app.registry.match_engineers", autospec=True
    ) as spy:
        task, routed_tool = run_llm_task("JOB001に合う要員を探して（余計な項目つき）")

    spy.assert_not_called()
    assert task.status == "error"
    assert "unexpected_field" in task.error


# --- wrong type for a required argument: validation fails, Tool is never
# called -----------------------------------------------------------------


def test_wrong_argument_type_never_reaches_the_tool():
    fake_llm = FakeLLM('{"tool_name": "engineer_match_tool", "arguments": {"job_id": 12345}}')

    with patch("app.llm_planner.OllamaProvider", return_value=fake_llm), patch(
        "app.registry.match_engineers", autospec=True
    ) as spy:
        task, routed_tool = run_llm_task("JOB001に合う要員を探して")

    spy.assert_not_called()
    assert task.status == "error"
    assert "job_id" in task.error


# --- zero-argument Tool: {} is valid, and the Tool does get called -------


def test_empty_arguments_are_valid_for_a_zero_argument_tool_and_it_runs():
    fake_llm = FakeLLM('{"tool_name": "current_time_tool", "arguments": {}}')

    with patch("app.llm_planner.OllamaProvider", return_value=fake_llm), patch(
        "app.registry.get_current_time", autospec=True
    ) as spy:
        spy.return_value = "2026-01-01 00:00:00"
        task, routed_tool = run_llm_task("今の時刻を教えて")

    spy.assert_called_once_with()
    assert task.status == "success"
    assert task.output == "2026-01-01 00:00:00"
