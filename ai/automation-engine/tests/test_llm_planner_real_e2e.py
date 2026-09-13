"""Real-LLM end-to-end check, separated from the normal (mocked/fast) test
suite: it calls an actual local Ollama server and can take 30-90+ seconds
depending on hardware and whether the model is already loaded — not
something that should run on every `pytest` invocation.

Skipped unless explicitly opted into with:

    RUN_REAL_LLM_TESTS=1 pytest tests/test_llm_planner_real_e2e.py -q

Requires `ollama serve` running locally with the model LLMPlanner defaults
to (qwen2.5:0.5b) already pulled (`ollama pull qwen2.5:0.5b`). No API keys
or secrets involved — this is a local model only.
"""

import os

import pytest

from app.main import run_llm_task

RUN_REAL_LLM_TESTS = os.environ.get("RUN_REAL_LLM_TESTS") == "1"


@pytest.mark.skipif(
    not RUN_REAL_LLM_TESTS,
    reason="set RUN_REAL_LLM_TESTS=1 to run against a real local Ollama model",
)
def test_a_real_local_llm_plans_and_executes_the_current_time_tool():
    task, routed_tool = run_llm_task("今の時刻を教えて")

    assert task.tool == "current_time_tool"
    assert routed_tool == "current_time_tool"
    assert task.status == "success"
