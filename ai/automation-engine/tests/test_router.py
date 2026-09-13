from app.router import ToolRouter


# --- existing behavior (rule-based Planner's Japanese labels) must keep
# working unchanged --------------------------------------------------------


def test_known_japanese_labels_still_route_to_their_tool():
    router = ToolRouter()

    assert router.route("現在時刻") == "current_time_tool"
    assert router.route("案件登録") == "project_register_tool"


def test_an_unrecognized_label_is_unknown_tool():
    assert ToolRouter().route("こんにちは") == "unknown_tool"


# --- new: pass through an already-valid registry tool name, e.g. one the
# LLM Planner picked directly rather than a Japanese label ------------------


def test_an_already_valid_registry_tool_name_passes_through_unchanged():
    router = ToolRouter()

    assert router.route("current_time_tool") == "current_time_tool"
    assert router.route("job_search_tool") == "job_search_tool"


def test_a_hallucinated_tool_name_is_still_unknown_tool():
    assert ToolRouter().route("foo_bar_tool") == "unknown_tool"
