from app.llm import LLMProvider
from app.llm_planner import LLMPlanner


class FakeLLM(LLMProvider):
    """Test double: returns a fixed, pre-canned response instead of ever
    calling a real model — LLMPlanner's job (prompt building, JSON parsing,
    tool-name validation) is what these tests check, not any real LLM."""

    def __init__(self, response: str):
        self.response = response
        self.last_prompt: str | None = None

    def generate(self, prompt: str) -> str:
        self.last_prompt = prompt
        return self.response


# --- valid response -> structured Task ------------------------------------


def test_valid_json_response_becomes_a_task_for_the_named_tool():
    fake_llm = FakeLLM('{"tool_name": "current_time_tool", "arguments": {}}')
    task = LLMPlanner(llm=fake_llm).plan("今の時刻を教えて")

    assert task.tool == "current_time_tool"
    assert task.parameters == {}
    assert task.instruction == "今の時刻を教えて"


def test_valid_json_response_carries_arguments_through():
    fake_llm = FakeLLM(
        '{"tool_name": "job_search_tool", "arguments": {"keyword": "Python"}}'
    )
    task = LLMPlanner(llm=fake_llm).plan("Python案件を探して")

    assert task.tool == "job_search_tool"
    assert task.parameters == {"keyword": "Python"}


def test_prompt_lists_the_actual_registered_tool_names():
    fake_llm = FakeLLM('{"tool_name": "current_time_tool", "arguments": {}}')
    LLMPlanner(llm=fake_llm).plan("今の時刻を教えて")

    assert fake_llm.last_prompt is not None
    assert "current_time_tool" in fake_llm.last_prompt
    assert "job_search_tool" in fake_llm.last_prompt
    assert "gmail_get_latest_email" in fake_llm.last_prompt


# --- responses wrapped in extra text/markdown, as small local models do ---


def test_json_wrapped_in_a_markdown_code_fence_is_still_parsed():
    fake_llm = FakeLLM(
        "```json\n"
        '{"tool_name": "current_time_tool", "arguments": {}}\n'
        "```"
    )
    task = LLMPlanner(llm=fake_llm).plan("今の時刻を教えて")

    assert task.tool == "current_time_tool"


def test_json_preceded_by_reasoning_preamble_is_still_parsed():
    fake_llm = FakeLLM(
        "<think>the user wants the time</think>\n"
        '{"tool_name": "current_time_tool", "arguments": {}}'
    )
    task = LLMPlanner(llm=fake_llm).plan("今の時刻を教えて")

    assert task.tool == "current_time_tool"


# --- unsafe/invalid responses -> tool="unknown" (spec: never trust the LLM
# to only ever name a real Tool; must fail the same way the rule-based
# Planner's own "no match" case does) ---------------------------------------


def test_a_hallucinated_tool_name_becomes_unknown():
    fake_llm = FakeLLM('{"tool_name": "foo_bar_tool", "arguments": {}}')
    task = LLMPlanner(llm=fake_llm).plan("何かして")

    assert task.tool == "unknown"


def test_malformed_json_becomes_unknown():
    fake_llm = FakeLLM("this is not json at all")
    task = LLMPlanner(llm=fake_llm).plan("何かして")

    assert task.tool == "unknown"


def test_missing_tool_name_key_becomes_unknown():
    fake_llm = FakeLLM('{"arguments": {}}')
    task = LLMPlanner(llm=fake_llm).plan("何かして")

    assert task.tool == "unknown"


def test_non_dict_arguments_becomes_unknown():
    fake_llm = FakeLLM('{"tool_name": "current_time_tool", "arguments": "now"}')
    task = LLMPlanner(llm=fake_llm).plan("今の時刻を教えて")

    assert task.tool == "unknown"
