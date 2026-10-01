import json
from datetime import datetime
from unittest.mock import patch

from app.main import run_task


def test_project_email_runs_through_the_full_loop_and_succeeds():
    email = (
        "Python/AWS案件です。リモート可。単価70〜80万円。"
        "9月開始。Python経験3年以上希望。"
    )

    # _extract_start_date() (app/planner.py) resolves "9月開始" relative to
    # "today": this year if 9月 hasn't passed yet, otherwise next year.
    # Fix "today" to a date safely before September so the expected year
    # below reflects that fixed point in time, not whatever month this
    # test happens to actually run in.
    with patch("app.planner.datetime") as mock_datetime:
        mock_datetime.now.return_value = datetime(2026, 1, 1)
        task, routed_tool = run_task(email)

    assert task.tool == "案件登録"
    assert routed_tool == "project_register_tool"
    assert task.status == "success"
    assert task.retry_count == 0

    result = json.loads(task.output)
    assert result["message"] == "案件登録を受け付けました"
    assert result["project"] == {
        "skills": ["Python", "AWS"],
        "location": "リモート",
        "budget_min": 700_000,
        "budget_max": 800_000,
        "start_date": "2026-09",
        "experience_years": 3,
    }
