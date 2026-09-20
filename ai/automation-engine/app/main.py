import json
import sys

from app.evaluator import Evaluator
from app.executor import ToolExecutor
from app.planner import Planner, Task
from app.recommender import Recommender
from app.repair import AIRepair
from app.router import ToolRouter
from app.tool_contract import build_tool_contracts, validate_arguments

MAX_RETRY = 1


def run_task(user_input: str) -> tuple[Task, str]:
    """User -> Planner -> Task -> Router -> Executor -> Evaluator ->
    (Success -> Result) | (Error -> Repair -> Retry(max 1) -> Result).

    Returns the Task (status/output/error/retry_count filled in) plus the
    tool name it actually finished on, so callers can act on the result
    (e.g. only invoke the Recommender for an engineer-match result)
    without re-deriving routing themselves.
    """
    task = Planner().plan(user_input)
    return _run_planned_task(task)


def run_llm_task(user_input: str) -> tuple[Task, str]:
    """Same Task -> Router -> Executor -> Evaluator -> Repair/Retry loop as
    run_task(), except the Task comes from LLMPlanner (a real LLM choosing
    a Tool + arguments) instead of the rule-based Planner — proves the
    pipeline is planner-agnostic without duplicating the loop.

    The same LLMPlanner instance is passed into _run_planned_task() so a
    Tool Contract validation failure can be repaired by asking it to
    regenerate (see llm_planner.replan_with_error()) rather than only the
    existing tool-name fallback repair.

    Imported lazily so the default rule-based CLI path never imports
    `ollama` (app.llm_planner -> app.llm -> ollama)."""
    from app.llm_planner import LLMPlanner

    planner = LLMPlanner()
    task = planner.plan(user_input)
    return _run_planned_task(task, llm_planner=planner)


def _execute_validated(routed_tool: str, task: Task, contracts: dict) -> tuple[str, str | None]:
    """Tool Contract validation, then (only if valid) the actual Executor
    call — arguments that don't satisfy the routed Tool's contract never
    reach ToolExecutor.execute()/`tool(**parameters)` at all.

    Returns (result, validation_error). `result` is in exactly the same
    two failure shapes ToolExecutor itself already produces ("Unknown
    tool", or a JSON string with an "error" key), so Evaluator needs no
    changes to recognize a validation failure as a failure.
    `validation_error` is the raw contract-violation message (None unless
    this specific call failed Tool Contract validation, as opposed to
    "unknown_tool" or a business-logic failure) — the one piece of extra
    information _run_planned_task() needs to decide whether a
    Validation-aware Repair applies."""
    contract = contracts.get(routed_tool)
    if contract is None:
        return "Unknown tool", None

    validation = validate_arguments(contract, task.parameters)
    if not validation.valid:
        result = json.dumps({"error": f"Invalid arguments: {validation.error}"}, ensure_ascii=False)
        return result, validation.error

    executor = ToolExecutor()
    return executor.execute(routed_tool, task.instruction, task.parameters), None


def _run_planned_task(task: Task, llm_planner=None) -> tuple[Task, str]:
    """The Router -> Tool Contract validation -> Executor -> Evaluator ->
    Repair/Retry(max 1) portion of the pipeline, shared by every Planner
    (rule-based or LLM) so it's implemented exactly once.

    Repair strategy per failure (still capped at the same MAX_RETRY=1 the
    loop already enforced before this change — one retry total, not one
    of each kind):
      - Tool Contract validation failed AND an llm_planner was given
        (i.e. this Task came from LLMPlanner): Validation-aware Repair —
        hand the LLM its own previous tool/arguments and the exact
        validation error, and let it regenerate once.
      - Anything else (unknown_tool, or a known tool that ran and failed
        on its own merits, e.g. "Job not found") or no llm_planner
        (rule-based Planner Task): unchanged — existing AIRepair
        tool-name fallback.
    Repaired tool+arguments are re-validated against the same Tool
    Contract before Executor runs, exactly like the first attempt — a
    repaired response is never trusted any more than the original one."""
    router = ToolRouter()
    evaluator = Evaluator()
    repair = AIRepair()
    contracts = build_tool_contracts()

    task.status = "running"

    routed_tool = router.route(task.tool)
    result, validation_error = _execute_validated(routed_tool, task, contracts)
    evaluation = evaluator.evaluate(result)

    while not evaluation.success and task.retry_count < MAX_RETRY:
        task.retry_count += 1

        if validation_error is not None and llm_planner is not None:
            task.tool, task.parameters = llm_planner.replan_with_error(
                task.instruction, task.tool, task.parameters, validation_error
            )
            routed_tool = router.route(task.tool)
        else:
            routed_tool = repair.repair(routed_tool)

        result, validation_error = _execute_validated(routed_tool, task, contracts)
        evaluation = evaluator.evaluate(result)

    if evaluation.success:
        task.status = "success"
        task.output = evaluation.output
    else:
        task.status = "error"
        task.error = evaluation.error

    return task, routed_tool


def _print_task_result(task: Task, routed_tool: str, label: str | None = None) -> None:
    prefix = f"[{label}] " if label else ""

    print(f"{prefix}Task: {task.instruction}")
    print(f"{prefix}Tool: {task.tool}")
    print(f"{prefix}Parameters: {task.parameters}")
    print(f"{prefix}Routed: {routed_tool}")
    print(f"{prefix}Status: {task.status}")
    print(f"{prefix}Retry count: {task.retry_count}")
    print(f"{prefix}Result: {task.output if task.status == 'success' else task.error}")

    if task.status == "success" and routed_tool == "engineer_match_tool":
        recommender = Recommender()
        explanation = recommender.explain(task.output)

        print(f"{prefix}Recommendation: {explanation}")


def run_gmail_intake_cli() -> None:
    """CLI entry point for the existing Gmail -> 案件登録 auto-intake chain
    (app.gmail_intake.run_gmail_project_intake). That function already had
    full test coverage but no way for a user to actually trigger it outside
    a test — this is the minimal wiring that makes it runnable.

    Imported lazily: app.gmail_intake imports run_task from this module, so
    importing it at module load time would be a circular import."""
    from app.gmail_intake import run_gmail_project_intake

    email_task, email_routed_tool, project_task, project_routed_tool = (
        run_gmail_project_intake()
    )

    _print_task_result(email_task, email_routed_tool, label="email")

    if project_task is None:
        print("[project] No project task: mailbox empty or email fetch failed.")
        return

    _print_task_result(project_task, project_routed_tool, label="project")


def main():
    if len(sys.argv) > 1 and sys.argv[1] == "--gmail-intake":
        run_gmail_intake_cli()
        return

    if len(sys.argv) > 1 and sys.argv[1] == "--llm":
        instruction = " ".join(sys.argv[2:])
        task, routed_tool = run_llm_task(instruction)
        _print_task_result(task, routed_tool, label="llm")
        return

    if len(sys.argv) > 1:
        # `python -m app.main <instruction>` — same run_task()/print path as
        # interactive mode, just skipping the input() prompt so a natural
        # language instruction can be passed directly (e.g. from a shell
        # script or another Tool), no separate implementation.
        user_input = " ".join(sys.argv[1:])
    else:
        user_input = input("User: ")

    task, routed_tool = run_task(user_input)
    _print_task_result(task, routed_tool)


if __name__ == "__main__":
    main()
