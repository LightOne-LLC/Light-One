"""Real end-to-end check for LLMPlatformBridgeProvider, separated from the
normal (mocked/fast) test suite — same pattern as
test_llm_planner_real_e2e.py, just through ai/llm-platform's execute-task
CLI instead of calling `ollama` directly.

Skipped unless explicitly opted into with:

    RUN_REAL_LLM_TESTS=1 pytest tests/test_llm_platform_bridge_real_e2e.py -q

Requires:
  - `ollama serve` running locally
  - Node.js + `npx`/`tsx` available (this repo's ai/llm-platform already
    depends on tsx; `npm install` there if `node_modules` is missing)
  - the model ai/llm-platform/llm/src/registry/models.json's
    "general-local" entry points at, actually pulled. This test does not
    assume any specific model or edit that registry -- whatever it's
    configured to is what gets exercised, exactly the way the bridge
    would behave for a real caller who hasn't touched the registry either.

No API keys or secrets involved -- this is a local model only, same as
test_llm_planner_real_e2e.py.
"""

import os

import pytest

from app.llm_planner import LLMPlanner
from app.llm_platform_bridge import LLMPlatformBridgeError, LLMPlatformBridgeProvider

RUN_REAL_LLM_TESTS = os.environ.get("RUN_REAL_LLM_TESTS") == "1"


@pytest.mark.skipif(
    not RUN_REAL_LLM_TESTS,
    reason="set RUN_REAL_LLM_TESTS=1 to run against a real ai/llm-platform + Ollama",
)
def test_bridge_reaches_a_real_local_model_through_llm_platform():
    bridge = LLMPlatformBridgeProvider(timeout_ms=120_000)

    try:
        text = bridge.generate("今の時刻を教えてください。")
    except LLMPlatformBridgeError as exc:
        pytest.fail(
            f"execute-task reached ai/llm-platform but returned an error "
            f"(code={exc.code}): {exc}. If this is MODEL_UNAVAILABLE, the "
            f"model llm-platform's registry points 'general-local' at "
            f"isn't pulled on this machine -- see this file's docstring."
        )

    assert isinstance(text, str)
    assert len(text) > 0


@pytest.mark.skipif(
    not RUN_REAL_LLM_TESTS,
    reason="set RUN_REAL_LLM_TESTS=1 to run against a real ai/llm-platform + Ollama",
)
def test_llmplanner_with_the_bridge_reaches_a_tool_through_a_real_model():
    """The actual scenario this bridge exists for: LLMPlanner(llm=...)
    given the bridge instead of the default OllamaProvider, driven by a
    real local model through ai/llm-platform end to end."""
    bridge = LLMPlatformBridgeProvider(timeout_ms=120_000)
    task = LLMPlanner(llm=bridge).plan("今の時刻を教えて")

    # Not asserting task.tool == "current_time_tool": a small local model
    # is not guaranteed to pick the right tool every run (LLMPlanner's own
    # real_e2e test makes that same bet for OllamaProvider). What matters
    # here is that the full chain -- Bridge -> subprocess -> execute-task
    # -> LLMRouter -> Ollama -> JSON -> LLMPlanner -- ran without raising,
    # and produced a well-formed Task either way (a real answer, or the
    # documented "unknown" fallback for an unparseable/off-format response).
    assert task.tool in {"unknown", "current_time_tool"}
