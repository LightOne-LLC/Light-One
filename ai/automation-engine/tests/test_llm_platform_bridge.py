"""Unit tests for LLMPlatformBridgeProvider — mocks subprocess.run so
these never touch a real Node process or Ollama (that's what
test_llm_platform_bridge_real_e2e.py is for)."""

import subprocess
from unittest.mock import Mock, patch

import pytest

from app.llm_platform_bridge import LLMPlatformBridgeError, LLMPlatformBridgeProvider


def _completed(stdout: str, returncode: int = 0) -> Mock:
    proc = Mock()
    proc.stdout = stdout
    proc.stderr = ""
    proc.returncode = returncode
    return proc


def test_generate_parses_a_well_formed_success_response():
    provider = LLMPlatformBridgeProvider(llm_platform_dir="/fake/llm-platform")

    with patch("app.llm_platform_bridge.subprocess.run") as mock_run:
        mock_run.return_value = _completed(
            '{"output": {"text": "hello from ollama"}, "trace": {"providerKind": "local"}}'
        )
        result = provider.generate("some prompt")

    assert result == "hello from ollama"
    args, kwargs = mock_run.call_args
    assert args[0] == ["npx", "tsx", "llm/src/cli.ts"]
    assert kwargs["input"]
    sent = kwargs["input"]
    import json

    sent_request = json.loads(sent)
    assert sent_request["task_type"] == "generate"
    assert sent_request["input"] == "some prompt"


def test_generate_raises_on_malformed_json_stdout():
    provider = LLMPlatformBridgeProvider(llm_platform_dir="/fake/llm-platform")

    with patch("app.llm_platform_bridge.subprocess.run") as mock_run:
        mock_run.return_value = _completed("this is not json", returncode=1)
        with pytest.raises(LLMPlatformBridgeError) as exc_info:
            provider.generate("some prompt")

    assert exc_info.value.code == "INVALID_JSON_STDOUT"


def test_generate_raises_on_subprocess_timeout():
    provider = LLMPlatformBridgeProvider(llm_platform_dir="/fake/llm-platform", timeout_ms=1_000)

    with patch("app.llm_platform_bridge.subprocess.run") as mock_run:
        mock_run.side_effect = subprocess.TimeoutExpired(cmd="npx", timeout=16)
        with pytest.raises(LLMPlatformBridgeError) as exc_info:
            provider.generate("some prompt")

    assert exc_info.value.code == "SUBPROCESS_TIMEOUT"


def test_generate_raises_on_structured_cli_error_with_nonzero_exit():
    provider = LLMPlatformBridgeProvider(llm_platform_dir="/fake/llm-platform")

    with patch("app.llm_platform_bridge.subprocess.run") as mock_run:
        mock_run.return_value = _completed(
            '{"error": {"code": "MODEL_UNAVAILABLE", "message": "model not pulled"}}',
            returncode=1,
        )
        with pytest.raises(LLMPlatformBridgeError) as exc_info:
            provider.generate("some prompt")

    assert exc_info.value.code == "MODEL_UNAVAILABLE"
    assert "model not pulled" in str(exc_info.value)


def test_generate_raises_when_npx_is_not_found():
    provider = LLMPlatformBridgeProvider(llm_platform_dir="/fake/llm-platform")

    with patch("app.llm_platform_bridge.subprocess.run") as mock_run:
        mock_run.side_effect = FileNotFoundError("npx not found")
        with pytest.raises(LLMPlatformBridgeError) as exc_info:
            provider.generate("some prompt")

    assert exc_info.value.code == "SUBPROCESS_NOT_FOUND"


def test_default_llm_platform_dir_resolves_to_the_sibling_package(monkeypatch):
    monkeypatch.delenv("LLM_PLATFORM_DIR", raising=False)
    provider = LLMPlatformBridgeProvider()

    assert provider.llm_platform_dir.name == "llm-platform"
    assert provider.llm_platform_dir.parent.name == "ai"


def test_llm_platform_dir_env_var_overrides_the_default(monkeypatch):
    monkeypatch.setenv("LLM_PLATFORM_DIR", "/custom/path")
    provider = LLMPlatformBridgeProvider()

    assert str(provider.llm_platform_dir) == "/custom/path"


def test_is_a_drop_in_llmprovider_for_llmplanner():
    """LLMPlanner(llm=...) only needs an object with .generate(prompt) ->
    str — the same inject point its own tests already use with FakeLLM."""
    from app.llm_planner import LLMPlanner

    with patch("app.llm_platform_bridge.subprocess.run") as mock_run:
        mock_run.return_value = _completed(
            '{"output": {"text": "{\\"tool_name\\": \\"current_time_tool\\", \\"arguments\\": {}}"}}'
        )
        bridge = LLMPlatformBridgeProvider(llm_platform_dir="/fake/llm-platform")
        task = LLMPlanner(llm=bridge).plan("今の時刻を教えて")

    assert task.tool == "current_time_tool"
