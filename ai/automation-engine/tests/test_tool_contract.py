from app.registry import ToolRegistry
from app.tool_contract import (
    build_tool_contracts,
    describe_tools_for_prompt,
    validate_arguments,
)


# --- contract derivation: from the real function signatures in
# app/tools.py via ToolRegistry, not a separately maintained schema -------


def test_contracts_are_built_for_every_registered_tool():
    contracts = build_tool_contracts()

    assert set(contracts) == set(ToolRegistry().tools)


def test_a_zero_argument_tool_has_no_arguments_in_its_contract():
    contracts = build_tool_contracts()

    assert contracts["current_time_tool"].arguments == []


def test_a_required_argument_is_marked_required_with_no_default():
    contracts = build_tool_contracts()
    (job_id_arg,) = contracts["engineer_match_tool"].arguments

    assert job_id_arg.name == "job_id"
    assert job_id_arg.required is True
    assert job_id_arg.type is str


def test_an_optional_argument_carries_its_actual_default():
    contracts = build_tool_contracts()
    (keyword_arg,) = contracts["job_search_tool"].arguments

    assert keyword_arg.name == "keyword"
    assert keyword_arg.required is False
    assert keyword_arg.default == ""


def test_a_tool_with_several_optional_arguments_derives_all_of_them():
    contracts = build_tool_contracts()
    names = {arg.name for arg in contracts["project_register_tool"].arguments}

    assert names == {
        "skills",
        "location",
        "budget_min",
        "budget_max",
        "start_date",
        "experience_years",
    }
    assert all(
        arg.required is False for arg in contracts["project_register_tool"].arguments
    )


# --- validate_arguments(): the same contract used to reject bad input ----


def test_valid_arguments_for_a_required_string_argument_pass():
    contract = build_tool_contracts()["engineer_match_tool"]

    result = validate_arguments(contract, {"job_id": "JOB001"})

    assert result.valid is True


def test_missing_required_argument_fails():
    contract = build_tool_contracts()["engineer_match_tool"]

    result = validate_arguments(contract, {})

    assert result.valid is False
    assert "job_id" in result.error


def test_unknown_argument_fails_even_alongside_a_valid_one():
    contract = build_tool_contracts()["engineer_match_tool"]

    result = validate_arguments(contract, {"job_id": "JOB001", "unexpected": "value"})

    assert result.valid is False
    assert "unexpected" in result.error


def test_wrong_type_for_a_required_string_argument_fails():
    contract = build_tool_contracts()["engineer_match_tool"]

    result = validate_arguments(contract, {"job_id": 12345})

    assert result.valid is False
    assert "job_id" in result.error


def test_empty_arguments_are_valid_for_a_zero_argument_tool():
    contract = build_tool_contracts()["current_time_tool"]

    result = validate_arguments(contract, {})

    assert result.valid is True


def test_an_unknown_argument_fails_even_for_a_zero_argument_tool():
    contract = build_tool_contracts()["current_time_tool"]

    result = validate_arguments(contract, {"unexpected": "value"})

    assert result.valid is False


def test_omitting_an_optional_argument_is_valid():
    contract = build_tool_contracts()["job_search_tool"]

    result = validate_arguments(contract, {})

    assert result.valid is True


def test_optional_nullable_arguments_accept_none():
    contract = build_tool_contracts()["project_register_tool"]

    result = validate_arguments(
        contract,
        {"skills": None, "location": None, "budget_min": None},
    )

    assert result.valid is True


def test_optional_nullable_int_argument_rejects_a_string_value():
    contract = build_tool_contracts()["project_register_tool"]

    result = validate_arguments(contract, {"budget_min": "not a number"})

    assert result.valid is False
    assert "budget_min" in result.error


# --- describe_tools_for_prompt(): the exact text shown to the LLM --------


def test_prompt_description_lists_required_and_optional_arguments():
    contracts = build_tool_contracts()
    text = describe_tools_for_prompt(contracts)

    assert "current_time_tool()" in text
    assert "job_id: string, required" in text
    assert "keyword: string, optional" in text
