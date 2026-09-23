"""LLM-backed Planner: turns a free-form natural language instruction into
one structured, executable Task by asking an LLM to choose among the
Automation Engine's actual registered Tools (spec: never let the LLM
free-generate a tool name) and validating its JSON output before it ever
reaches Router/Executor/Evaluator.

Deliberately not a replacement for the existing rule-based Planner — that
one (app.planner.Planner) is untouched and still the default path; this is
an alternate Planner proving the same Router/Executor/Evaluator loop also
works when a real LLM produces the Task instead of keyword rules.

Reuses the Automation Engine's own existing LLM abstraction (app.llm,
already used by Recommender) rather than inventing a new connection
method or reaching into ai/llm-platform — that package is a separate
Node/TypeScript project with no Python bridge today, and wiring one is
out of scope for this minimal change.

The Tool list (and each Tool's arguments) shown in the prompt comes from
app.tool_contract.build_tool_contracts()/describe_tools_for_prompt() — the
exact same Tool Contract that app.main._run_planned_task() validates
arguments against before Executor runs. One contract, two consumers, so
the LLM is never shown a spec that validation then judges it against
differently.
"""

import json

from app.llm import LLMProvider, OllamaProvider
from app.planner import Task
from app.registry import ToolRegistry
from app.tool_contract import build_tool_contracts, describe_tools_for_prompt

_PROMPT_TEMPLATE = """あなたはタスクプランナーです。ユーザーの指示を読み、
以下のツールの中から最も適切な1つを選び、必要な引数とともにJSON形式のみで
返してください。説明文やコードブロックは不要です。JSON以外は出力しないこと。
各ツールの引数名・型・必須かどうかは以下の仕様に厳密に従うこと。存在しない
引数名を作らないこと。

利用可能なツール:
{tool_specs}

出力形式（このJSON形式のみを出力すること）:
{{"tool_name": "<ツール名>", "arguments": {{}}}}

ユーザーの指示: {instruction}
"""

_REPAIR_PROMPT_TEMPLATE = """あなたはタスクプランナーです。前回、以下のツール呼び出しを
生成しましたが、Tool契約に違反したため実行できませんでした。

利用可能なツール:
{tool_specs}

ユーザーの指示: {instruction}

前回生成した tool_name: {previous_tool}
前回生成した arguments: {previous_arguments}
Validation Error: {validation_error}

上記のValidation Errorの原因を理解し、修正すること。前回のargumentsを
そのまま繰り返さないこと。「optional」のようなメタデータ用のキー名を
argumentsに追加しないこと（任意引数がある場合は、その引数名自体を
argumentsのキーとして直接使うこと）。利用可能なツールの仕様に記載された
引数名だけを使い、required（必須）の引数は必ず含めること。同じユーザーの
指示を満たすvalidな tool_name と arguments を1つだけJSON形式で返して
ください。説明文やコードブロックは不要です。JSON以外は出力しないこと。

出力形式（このJSON形式のみを出力すること）:
{{"tool_name": "<ツール名>", "arguments": {{}}}}
"""


class LLMPlanner:
    """Prompts an LLMProvider for {tool_name, arguments}, then validates
    tool_name against the ToolRegistry before building a Task. An invalid
    or hallucinated tool name, or malformed JSON, becomes tool="unknown" —
    the same value the rule-based Planner already returns for "no match" —
    so Router/Evaluator/Repair handle it exactly the same way, with no new
    failure-handling logic needed.

    Note: this only rejects a tool_name that isn't a real Tool. Whether
    `arguments` actually satisfies that Tool's contract (required fields,
    types, no unknown keys) is checked later, in
    app.main._run_planned_task(), against the same Tool Contract this
    class's prompt was built from — see app.tool_contract."""

    def __init__(self, llm: LLMProvider | None = None):
        # qwen2.5:0.5b, not qwen3:0.6b (Recommender's model, left untouched):
        # qwen3 emits a long <think>...</think> preamble by default, which
        # this Engine's CPU-only local environment can take minutes to
        # generate for even a one-line answer — qwen2.5 answers directly.
        self.llm = llm or OllamaProvider(model="qwen2.5:0.5b")
        self.registry = ToolRegistry()

    def plan(self, user_input: str) -> Task:
        contracts = build_tool_contracts(self.registry)
        prompt = _PROMPT_TEMPLATE.format(
            tool_specs=describe_tools_for_prompt(contracts),
            instruction=user_input,
        )

        raw_response = self.llm.generate(prompt)
        tool_name, arguments = self._parse(raw_response, sorted(contracts))

        return Task(
            instruction=user_input,
            tool=tool_name,
            parameters=arguments,
        )

    def replan_with_error(
        self,
        user_input: str,
        previous_tool: str,
        previous_arguments: dict,
        validation_error: str,
    ) -> tuple[str, dict]:
        """Validation-aware Repair, called at most once by
        app.main._run_planned_task() when Tool Contract validation rejects
        this Planner's own output: shows the LLM the exact contract
        violation from the failed attempt and asks it to regenerate.

        Reuses the same Tool Contract prompt data and the same
        _parse()/tool-name-validation logic as plan() — no separate
        response format, no separate schema."""
        contracts = build_tool_contracts(self.registry)
        prompt = _REPAIR_PROMPT_TEMPLATE.format(
            tool_specs=describe_tools_for_prompt(contracts),
            instruction=user_input,
            previous_tool=previous_tool,
            previous_arguments=json.dumps(previous_arguments, ensure_ascii=False),
            validation_error=validation_error,
        )

        raw_response = self.llm.generate(prompt)
        return self._parse(raw_response, sorted(contracts))

    @staticmethod
    def _parse(raw_response: str, valid_tool_names: list[str]) -> tuple[str, dict]:
        json_text = LLMPlanner._extract_json_object(raw_response)

        try:
            parsed = json.loads(json_text)
        except (json.JSONDecodeError, TypeError):
            return "unknown", {}

        if not isinstance(parsed, dict):
            return "unknown", {}

        tool_name = parsed.get("tool_name")
        arguments = parsed.get("arguments")
        if arguments is None:
            arguments = {}

        if tool_name not in valid_tool_names or not isinstance(arguments, dict):
            return "unknown", {}

        return tool_name, arguments

    @staticmethod
    def _extract_json_object(raw_response: str) -> str:
        # Small local models commonly wrap JSON in ```json fences, add a
        # <think>...</think> preamble, or otherwise surround it with text —
        # pull out the first {...} block rather than requiring a perfectly
        # bare JSON response.
        start = raw_response.find("{")
        end = raw_response.rfind("}")
        if start == -1 or end == -1 or end < start:
            return raw_response
        return raw_response[start : end + 1]
