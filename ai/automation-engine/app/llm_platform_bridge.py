"""LLMPlatformBridgeProvider: an LLMProvider that reaches ai/llm-platform's
`execute-task` CLI (a separate Node/TypeScript process, Router ->
ModelRegistry -> Provider -> Ollama/Claude/OpenAI/Gemini) over subprocess,
instead of calling Ollama directly the way app.llm.OllamaProvider does.

Purely additive: app.llm.OllamaProvider is untouched and stays the default
everywhere (Recommender, LLMPlanner's own default). This is a second,
opt-in LLMProvider that LLMPlanner(llm=...) can be given instead, proving
the Automation Engine can reach ai/llm-platform as an alternative path —
not a replacement.

Wire format: the same LLMTaskRequest ai/llm-platform's execute-task CLI
already accepts (see ai/llm-platform/README.md, "Calling the Router from
outside this package"). No new format invented here. Uses task_type
"generate" specifically — a single free-form prompt in, a single
free-form text out — because that's the shape LLMPlanner's prompt
actually needs; "classify"'s fixed {category, confidence, reason} output
shape doesn't fit a tool-selection prompt (confirmed by trying it: Ollama
returns the {tool_name, arguments} JSON the prompt itself asks for, which
execute-task's classify path then rejects as MalformedOutputError since
it's missing "category" — not a graceful "unknown" fallback, a hard
failure. See ai/llm-platform/llm/src/cli.ts for the matching CLI-side fix
that added "generate" support alongside this file).
"""

from __future__ import annotations

import json
import os
import subprocess
from pathlib import Path

from app.llm import LLMProvider

DEFAULT_TIMEOUT_MS = 120_000
_SUBPROCESS_TIMEOUT_BUFFER_S = 15


class LLMPlatformBridgeError(RuntimeError):
    """Raised when execute-task could not be reached, or returned
    something that isn't a valid/expected response. Carries the same
    `code` the TypeScript side's LLMProviderError uses when the failure
    came from *inside* the CLI (e.g. "TIMEOUT", "MODEL_UNAVAILABLE"), or a
    bridge-specific one (e.g. "SUBPROCESS_TIMEOUT") when the failure is at
    the transport layer instead."""

    def __init__(self, message: str, code: str = "BRIDGE_ERROR"):
        super().__init__(message)
        self.code = code


def _default_llm_platform_dir() -> Path:
    override = os.environ.get("LLM_PLATFORM_DIR")
    if override:
        return Path(override)
    # this file: ai/automation-engine/app/llm_platform_bridge.py
    # sibling package: ai/llm-platform
    return Path(__file__).resolve().parents[2] / "llm-platform"


class LLMPlatformBridgeProvider(LLMProvider):
    """Calls ai/llm-platform's `execute-task` CLI over subprocess for each
    `generate()` call. stdout is machine-readable JSON only; any
    diagnostic/log output from the subprocess goes to stderr and is never
    parsed — only surfaced in error messages if something goes wrong."""

    def __init__(
        self,
        domain: str = "general",
        timeout_ms: int = DEFAULT_TIMEOUT_MS,
        privacy: str = "high",
        llm_platform_dir: str | Path | None = None,
    ):
        self.domain = domain
        self.timeout_ms = timeout_ms
        self.privacy = privacy
        self.llm_platform_dir = Path(llm_platform_dir) if llm_platform_dir else _default_llm_platform_dir()

    def generate(self, prompt: str) -> str:
        request = {
            "task_type": "generate",
            "domain": self.domain,
            "input": prompt,
            "requirements": {"privacy": self.privacy},
            "timeout_ms": self.timeout_ms,
        }

        # npx tsx (not `npm run execute-task`): npm prints its own banner
        # lines to stdout ahead of the CLI's JSON, which breaks a bare
        # json.loads(stdout) — confirmed by capturing raw stdout
        # byte-for-byte. See ai/llm-platform/README.md's execute-task
        # section for the same note.
        try:
            proc = subprocess.run(
                ["npx", "tsx", "llm/src/cli.ts"],
                cwd=self.llm_platform_dir,
                input=json.dumps(request),
                capture_output=True,
                text=True,
                timeout=(self.timeout_ms / 1000) + _SUBPROCESS_TIMEOUT_BUFFER_S,
            )
        except subprocess.TimeoutExpired as exc:
            raise LLMPlatformBridgeError(
                f"execute-task did not exit within {exc.timeout:.0f}s (subprocess-level timeout, "
                f"beyond the {self.timeout_ms}ms the CLI itself was given)",
                code="SUBPROCESS_TIMEOUT",
            ) from exc
        except FileNotFoundError as exc:
            raise LLMPlatformBridgeError(
                f"could not launch npx/tsx (is Node.js installed and on PATH?): {exc}",
                code="SUBPROCESS_NOT_FOUND",
            ) from exc

        try:
            parsed = json.loads(proc.stdout)
        except json.JSONDecodeError as exc:
            raise LLMPlatformBridgeError(
                f"execute-task stdout was not valid JSON (exit={proc.returncode}): {proc.stdout!r}; "
                f"stderr: {proc.stderr!r}",
                code="INVALID_JSON_STDOUT",
            ) from exc

        if "error" in parsed:
            error = parsed["error"]
            raise LLMPlatformBridgeError(
                f"execute-task reported an error: {error.get('message')}",
                code=error.get("code", "UNKNOWN"),
            )

        try:
            return parsed["output"]["text"]
        except (KeyError, TypeError) as exc:
            raise LLMPlatformBridgeError(
                f"execute-task succeeded but the response had no output.text: {parsed!r}",
                code="UNEXPECTED_RESPONSE_SHAPE",
            ) from exc
