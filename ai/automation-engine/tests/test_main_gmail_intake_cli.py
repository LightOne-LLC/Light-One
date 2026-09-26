from unittest.mock import patch

from app.main import main


def _fake_email(body: str) -> dict:
    return {
        "id": "msg-1",
        "from": "agency@example.com",
        "subject": "案件のご紹介",
        "body": body,
        "date": "Mon, 1 Sep 2026 09:00:00 +0900",
    }


# --- `python -m app.main --gmail-intake` wires the existing, previously
# test-only run_gmail_project_intake() chain up as an actual user-runnable
# command, without touching input()/stdin (spec: distinct from the default
# interactive path).


def test_gmail_intake_flag_runs_the_full_chain_without_prompting_for_input(capsys):
    fake_email = _fake_email(
        "Python/AWS案件です。リモート可。単価70〜80万円。9月開始。Python経験3年以上希望。"
    )

    with patch("app.gmail_client.get_latest_email", return_value=fake_email), patch(
        "sys.argv", ["app.main", "--gmail-intake"]
    ), patch("builtins.input", side_effect=AssertionError("should not prompt")):
        main()

    output = capsys.readouterr().out

    assert "[email] Status: success" in output
    assert "[project] Tool: 案件登録" in output
    assert "[project] Status: success" in output


def test_gmail_intake_flag_reports_no_project_task_when_mailbox_is_empty(capsys):
    with patch("app.gmail_client.get_latest_email", return_value=None), patch(
        "sys.argv", ["app.main", "--gmail-intake"]
    ), patch("builtins.input", side_effect=AssertionError("should not prompt")):
        main()

    output = capsys.readouterr().out

    assert "[email] Status: success" in output
    assert "[project] No project task" in output


def test_without_the_flag_the_interactive_path_is_unchanged(capsys):
    with patch("sys.argv", ["app.main"]), patch("builtins.input", return_value="今の時刻を教えて"):
        main()

    output = capsys.readouterr().out

    # No "[email]"/"[project]" prefix — same plain format as before this
    # change (spec item 6: existing正常系 must keep working unchanged).
    assert "Tool: 現在時刻" in output
    assert "[email]" not in output
