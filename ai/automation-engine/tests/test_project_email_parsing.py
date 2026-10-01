from datetime import datetime
from unittest.mock import patch

from app.planner import Planner


def test_full_project_email_is_parsed_into_all_fields():
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
        task = Planner().plan(email)

    assert task.tool == "案件登録"
    assert task.parameters == {
        "skills": ["Python", "AWS"],
        "location": "リモート",
        "budget_min": 700_000,
        "budget_max": 800_000,
        "start_date": "2026-09",
        "experience_years": 3,
    }


def test_partial_project_email_leaves_missing_fields_as_none():
    # No location, no start date, no experience-year mention.
    email = "Python案件です。単価70万円。"

    task = Planner().plan(email)

    assert task.tool == "案件登録"
    assert task.parameters["skills"] == ["Python"]
    assert task.parameters["location"] is None
    assert task.parameters["budget_min"] == 700_000
    assert task.parameters["budget_max"] == 700_000
    assert task.parameters["start_date"] is None
    assert task.parameters["experience_years"] is None


def test_different_skill_set_is_not_hardcoded_to_python_aws():
    email = (
        "Java/Spring案件です。東京勤務。単価60〜65万円。"
        "10月開始。経験5年以上希望。"
    )

    # Same fixed-"today" reasoning as test_full_project_email_is_parsed_
    # into_all_fields above — this test passed only by coincidence when
    # the real current month happened to be <= 10; fixing "today" makes
    # it stable regardless of when it actually runs.
    with patch("app.planner.datetime") as mock_datetime:
        mock_datetime.now.return_value = datetime(2026, 1, 1)
        task = Planner().plan(email)

    assert task.tool == "案件登録"
    assert task.parameters["skills"] == ["Java", "Spring"]
    assert task.parameters["location"] == "東京"
    assert task.parameters["budget_min"] == 600_000
    assert task.parameters["budget_max"] == 650_000
    assert task.parameters["start_date"] == "2026-10"
    assert task.parameters["experience_years"] == 5


def test_project_email_with_業務時間_wording_is_still_routed_to_registration():
    # Regression guard: "就業時間" contains the substring "時間", which
    # must not steal the route to 現在時刻 before 案件登録 gets a chance.
    email = (
        "Go/PHP案件です。リモート勤務。◆就業時間：10:00~19:00。"
        "◆金額：単価100万円以上。"
    )

    task = Planner().plan(email)

    assert task.tool == "案件登録"
    assert task.parameters["budget_min"] == 1_000_000


def test_project_search_query_is_still_routed_as_job_search_not_registration():
    # Regression guard: a plain search query must not be swept into the
    # new 案件登録 branch just because it contains "案件".
    task = Planner().plan("Python案件を探して")

    assert task.tool == "案件検索"
    assert task.parameters == {"keyword": "Python"}
