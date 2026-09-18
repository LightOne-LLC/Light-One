"""Tool Contract: derives each registered Tool's argument spec directly
from its Python function signature (inspect.signature over
app.registry.ToolRegistry.tools) — the same functions ToolExecutor.execute()
already calls as `tool(**parameters)`. There is deliberately no separate
schema file: the function signature *is* the contract, so it can never
drift out of sync with what a Tool actually accepts.

Two consumers share exactly this same contract (spec: avoid "LLM was shown
spec A, validated against spec B"):
  - LLMPlanner prompts with `describe_tools_for_prompt()`.
  - app.main._run_planned_task() validates LLM/rule-based arguments with
    `validate_arguments()` before Executor ever sees them.

No description field is generated: none of the Tool functions in
app/tools.py have docstrings today, and fabricating one would be
guessing at something the implementation doesn't actually say.
"""

import inspect
import types
import typing
from dataclasses import dataclass, field
from typing import Any

from app.registry import ToolRegistry

_TYPE_LABELS = {
    str: "string",
    int: "integer",
    float: "number",
    bool: "boolean",
    list: "array",
    dict: "object",
}


@dataclass
class ArgumentSpec:
    name: str
    required: bool
    type: Any = None
    default: Any = None


@dataclass
class ToolContract:
    name: str
    arguments: list[ArgumentSpec] = field(default_factory=list)


@dataclass
class ValidationResult:
    valid: bool
    error: str | None = None


def build_tool_contracts(registry: ToolRegistry | None = None) -> dict[str, ToolContract]:
    """One ToolContract per registered Tool, derived from its actual
    Python function signature — required means "no default value",
    exactly as Python itself already enforces at call time."""
    registry = registry or ToolRegistry()
    contracts: dict[str, ToolContract] = {}

    for tool_name, func in registry.tools.items():
        signature = inspect.signature(func)
        arguments = [
            _argument_spec(param)
            for param in signature.parameters.values()
            if param.kind
            in (inspect.Parameter.POSITIONAL_OR_KEYWORD, inspect.Parameter.KEYWORD_ONLY)
        ]
        contracts[tool_name] = ToolContract(name=tool_name, arguments=arguments)

    return contracts


def _argument_spec(param: inspect.Parameter) -> ArgumentSpec:
    required = param.default is inspect.Parameter.empty
    annotation = param.annotation if param.annotation is not inspect.Parameter.empty else None
    default = None if required else param.default
    return ArgumentSpec(name=param.name, required=required, type=annotation, default=default)


def validate_arguments(contract: ToolContract, arguments: dict) -> ValidationResult:
    """Rejects anything ToolExecutor.execute()'s `tool(**parameters)` call
    would otherwise either crash on or silently accept without the Tool
    ever having asked for it: unknown keyword arguments, missing required
    arguments, and (where the Tool declares a type annotation) a value of
    the wrong type."""
    if not isinstance(arguments, dict):
        return ValidationResult(False, "arguments must be a JSON object")

    known_names = {arg.name for arg in contract.arguments}
    unknown = sorted(set(arguments) - known_names)
    if unknown:
        return ValidationResult(False, f"unknown argument(s): {', '.join(unknown)}")

    for arg in contract.arguments:
        if arg.required and arg.name not in arguments:
            return ValidationResult(False, f"missing required argument: {arg.name}")

        if arg.name in arguments and arg.type is not None:
            value = arguments[arg.name]
            if not _matches_type(value, arg.type):
                expected = _type_label(arg.type)
                return ValidationResult(
                    False,
                    f"argument '{arg.name}' expected type {expected}, "
                    f"got {type(value).__name__}",
                )

    return ValidationResult(True)


def _matches_type(value: Any, annotation: Any) -> bool:
    origin = typing.get_origin(annotation)

    if origin is types.UnionType or origin is typing.Union:
        return any(_matches_type(value, member) for member in typing.get_args(annotation))

    if annotation is type(None):
        return value is None

    if origin is list:
        return isinstance(value, list)

    if origin is dict:
        return isinstance(value, dict)

    if isinstance(annotation, type):
        # bool is a subclass of int in Python — without this guard, True
        # would silently pass as a valid `int` argument.
        if annotation is int and isinstance(value, bool):
            return False
        return isinstance(value, annotation)

    return True  # an annotation shape we don't recognize: don't block on it


def _type_label(annotation: Any) -> str:
    origin = typing.get_origin(annotation)

    if origin is types.UnionType or origin is typing.Union:
        members = [_type_label(member) for member in typing.get_args(annotation) if member is not type(None)]
        return " | ".join(members) if members else "any"

    if origin is list:
        return "array"

    if origin is dict:
        return "object"

    return _TYPE_LABELS.get(annotation, getattr(annotation, "__name__", "any"))


def describe_tools_for_prompt(contracts: dict[str, ToolContract]) -> str:
    """One line per Tool, e.g.:

    current_time_tool()
    job_search_tool(keyword: string, optional, default="")
    engineer_match_tool(job_id: string, required)

    Fed to LLMPlanner's prompt so the LLM only ever sees (and is expected
    to follow) the exact same contract arguments are validated against."""
    lines = []

    for tool_name in sorted(contracts):
        contract = contracts[tool_name]
        if not contract.arguments:
            lines.append(f"{tool_name}()")
            continue

        parts = []
        for arg in contract.arguments:
            requirement = "required" if arg.required else f"optional, default={arg.default!r}"
            parts.append(f"{arg.name}: {_type_label(arg.type)}, {requirement}")

        lines.append(f"{tool_name}({'; '.join(parts)})")

    return "\n".join(lines)
