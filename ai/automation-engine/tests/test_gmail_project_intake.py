import json
from datetime import datetime
from unittest.mock import patch

from app.gmail_intake import run_gmail_project_intake


def _fake_email(body: str) -> dict:
    return {
        "id": "msg-1",
        "from": "agency@example.com",
        "subject": "案件のご紹介",
        "body": body,
        "date": "Mon, 1 Sep 2026 09:00:00 +0900",
    }


def test_a_project_posting_email_flows_all_the_way_to_project_registration():
    fake_email = _fake_email(
        "Python/AWS案件です。リモート可。単価70〜80万円。9月開始。Python経験3年以上希望。"
    )

    # _extract_start_date() (app/planner.py) resolves "9月開始" relative to
    # "today": fix it to a date safely before September, same as
    # test_project_register_execution.py, so the expected year below
    # doesn't depend on the real month this test happens to run in.
    with patch("app.gmail_client.get_latest_email", return_value=fake_email), patch(
        "app.planner.datetime"
    ) as mock_datetime:
        mock_datetime.now.return_value = datetime(2026, 1, 1)
        email_task, email_routed_tool, project_task, project_routed_tool = run_gmail_project_intake()

    assert email_task.status == "success"
    assert email_routed_tool == "gmail_get_latest_email"

    assert project_task is not None
    assert project_task.tool == "案件登録"
    assert project_routed_tool == "project_register_tool"
    assert project_task.status == "success"
    assert project_task.retry_count == 0

    result = json.loads(project_task.output)
    assert result["project"] == {
        "skills": ["Python", "AWS"],
        "location": "リモート",
        "budget_min": 700_000,
        "budget_max": 800_000,
        "start_date": "2026-09",
        "experience_years": 3,
    }


def test_a_non_project_email_still_plans_and_executes_without_crashing():
    fake_email = _fake_email("お世話になっております。会議室のご予約を確認いたします。")

    with patch("app.gmail_client.get_latest_email", return_value=fake_email):
        _, _, project_task, project_routed_tool = run_gmail_project_intake()

    # No 案件/単価/万円 signal -> Planner falls back to "unknown" -> Router
    # can't map it -> Repair falls back to job_search_tool, same as any
    # other unrecognized free-text input (existing behavior, unchanged).
    assert project_task is not None
    assert project_task.tool == "unknown"
    assert project_routed_tool == "job_search_tool"
    assert project_task.status == "success"
    assert project_task.retry_count == 1


def test_returns_no_project_task_when_the_mailbox_is_empty():
    with patch("app.gmail_client.get_latest_email", return_value=None):
        email_task, email_routed_tool, project_task, project_routed_tool = run_gmail_project_intake()

    assert email_task.status == "success"
    assert email_routed_tool == "gmail_get_latest_email"
    assert project_task is None
    assert project_routed_tool is None
