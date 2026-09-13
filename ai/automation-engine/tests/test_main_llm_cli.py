from unittest.mock import patch

from app.llm import LLMProvider
from app.main import main, run_llm_task


class FakeLLM(LLMProvider):
    def __init__(self, response: str):
        self.response = response

    def generate(self, prompt: str) -> str:
        return self.response


# --- run_llm_task(): LLMPlanner -> same Router/Executor/Evaluator/Repair
# loop as run_task(), just with an LLM-produced Task -----------------------


def test_run_llm_task_reaches_the_tool_and_succeeds():
    fake_llm = FakeLLM('{"tool_name": "current_time_tool", "arguments": {}}')

    with patch("app.llm_planner.OllamaProvider", return_value=fake_llm):
        task, routed_tool = run_llm_task("今の時刻を教えて")

    assert task.tool == "current_time_tool"
    assert routed_tool == "current_time_tool"
    assert task.status == "success"
    assert task.retry_count == 0


def test_run_llm_task_repairs_and_retries_when_the_llm_hallucinates_a_tool():
    fake_llm = FakeLLM('{"tool_name": "foo_bar_tool", "arguments": {}}')

    with patch("app.llm_planner.OllamaProvider", return_value=fake_llm):
        task, routed_tool = run_llm_task("何かして")

    # Same fallback as an unrecognized rule-based instruction: Router can't
    # map tool="unknown" -> "unknown_tool" -> Repair falls back to
    # job_search_tool -> retry succeeds.
    assert task.tool == "unknown"
    assert task.status == "success"
    assert task.retry_count == 1
    assert routed_tool == "job_search_tool"


# --- `python -m app.main --llm "<instruction>"` CLI wiring -----------------


def test_llm_flag_runs_the_full_chain_without_prompting_for_input(capsys):
    fake_llm = FakeLLM('{"tool_name": "current_time_tool", "arguments": {}}')

    with patch("app.llm_planner.OllamaProvider", return_value=fake_llm), patch(
        "sys.argv", ["app.main", "--llm", "今の時刻を教えて"]
    ), patch("builtins.input", side_effect=AssertionError("should not prompt")):
        main()

    output = capsys.readouterr().out

    assert "[llm] Tool: current_time_tool" in output
    assert "[llm] Routed: current_time_tool" in output
    assert "[llm] Status: success" in output
