import sys

from app.evaluator import Evaluator
from app.executor import ToolExecutor
from app.planner import Planner, Task
from app.recommender import Recommender
from app.repair import AIRepair
from app.router import ToolRouter

MAX_RETRY = 1


def run_task(user_input: str) -> tuple[Task, str]:
    """User -> Planner -> Task -> Router -> Executor -> Evaluator ->
    (Success -> Result) | (Error -> Repair -> Retry(max 1) -> Result).

    Returns the Task (status/output/error/retry_count filled in) plus the
    tool name it actually finished on, so callers can act on the result
    (e.g. only invoke the Recommender for an engineer-match result)
    without re-deriving routing themselves.
    """
    planner = Planner()
    router = ToolRouter()
    executor = ToolExecutor()
    evaluator = Evaluator()
    repair = AIRepair()

    task = planner.plan(user_input)
    task.status = "running"

    routed_tool = router.route(task.tool)
    result = executor.execute(routed_tool, task.instruction, task.parameters)
    evaluation = evaluator.evaluate(result)

    while not evaluation.success and task.retry_count < MAX_RETRY:
        task.retry_count += 1
        routed_tool = repair.repair(routed_tool)
        result = executor.execute(routed_tool, task.instruction, task.parameters)
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

    user_input = input("User: ")
    task, routed_tool = run_task(user_input)
    _print_task_result(task, routed_tool)


if __name__ == "__main__":
    main()
