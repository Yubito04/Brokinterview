import json
from datetime import date

import anthropic
import httpx2
import pytest

from app.config import Settings
from app.llm import (
    SYSTEM_PROMPT,
    AnthropicJobExtractor,
    ExtractedJob,
    ExtractionFailed,
    ExtractionTimedOut,
    MODEL_ATTEMPT_TIMEOUT,
    MODEL_MAX_RETRIES,
    get_job_extractor,
)

TOKEN_USAGE = {"input_tokens": 10, "output_tokens": 10}


def message_json(text: str, stop_reason: str = "end_turn") -> dict:
    return {
        "id": "msg_test",
        "type": "message",
        "role": "assistant",
        "model": "claude-haiku-5-5",
        "content": [{"type": "text", "text": text}],
        "stop_reason": stop_reason,
        "stop_sequence": None,
        "usage": TOKEN_USAGE,
    }


def build_extractor(handler, max_retries: int = 0) -> AnthropicJobExtractor:
    # The real SDK, but its HTTP layer is replaced: no network, no cost, and we can
    # inspect exactly what would have been sent to Anthropic.
    http_client = httpx2.Client(transport=httpx2.MockTransport(handler))
    client = anthropic.Anthropic(api_key="test-key", http_client=http_client, max_retries=max_retries)
    return AnthropicJobExtractor(client, "claude-haiku-5-5")


ANSWER = {
    "company": "Acme",
    "position": "Backend Developer",
    "location": None,
    "deadline": "2026-12-01",
    "skills": ["Python"],
}


def test_request_sent_to_the_model():
    sent = {}

    def handler(request):
        sent.update(json.loads(request.content))
        return httpx2.Response(200, json=message_json(json.dumps(ANSWER)))

    extractor = build_extractor(handler)
    extractor.extract("We hire a developer", date(2026, 11, 9))

    assert sent["model"] == "claude-haiku-5-5"
    assert sent["output_config"]["effort"] == "low"
    assert "tools" not in sent  # the model can only answer, never act
    assert sent["system"] == SYSTEM_PROMPT
    # The answer must follow the ExtractedJob schema.
    schema = sent["output_config"]["format"]["schema"]
    assert set(schema["properties"]) == set(ExtractedJob.model_fields)


def test_user_message_has_todays_date_and_the_posting_between_tags():
    sent = {}

    def handler(request):
        sent.update(json.loads(request.content))
        return httpx2.Response(200, json=message_json(json.dumps(ANSWER)))

    build_extractor(handler).extract("We hire a developer", date(2026, 11, 9))

    [message] = sent["messages"]
    assert message["role"] == "user"
    assert message["content"] == (
        "Today's date: 2026-11-09\n\n<job_posting>\nWe hire a developer\n</job_posting>"
    )


def test_answer_is_parsed_into_extracted_job():
    extractor = build_extractor(
        lambda request: httpx2.Response(200, json=message_json(json.dumps(ANSWER)))
    )

    result = extractor.extract("text", date(2026, 11, 9))

    assert result == ExtractedJob(
        company="Acme",
        position="Backend Developer",
        location=None,
        deadline=date(2026, 12, 1),
        skills=["Python"],
    )


def test_answer_without_skills_gives_an_empty_list():
    answer = {**ANSWER, "skills": []}
    extractor = build_extractor(
        lambda request: httpx2.Response(200, json=message_json(json.dumps(answer)))
    )

    assert extractor.extract("text", date(2026, 11, 9)).skills == []


def test_null_skills_break_the_schema_and_become_extraction_failed():
    # skills is a list that may be empty, never null: the model must follow that.
    answer = {**ANSWER, "skills": None}
    extractor = build_extractor(
        lambda request: httpx2.Response(200, json=message_json(json.dumps(answer)))
    )

    with pytest.raises(ExtractionFailed):
        extractor.extract("text", date(2026, 11, 9))


def test_prompt_limits_skills_to_technical_ones_and_asks_for_an_empty_list():
    assert "only technical skills" in SYSTEM_PROMPT
    assert "empty list []" in SYSTEM_PROMPT


@pytest.mark.parametrize("status", [401, 429, 500, 529])
def test_api_errors_become_extraction_failed(status):
    error_body = {"type": "error", "error": {"type": "api_error", "message": "boom"}}
    extractor = build_extractor(lambda request: httpx2.Response(status, json=error_body))

    with pytest.raises(ExtractionFailed):
        extractor.extract("text", date(2026, 11, 9))


def test_network_error_becomes_extraction_failed():
    def handler(request):
        raise httpx2.ConnectError("network down")

    with pytest.raises(ExtractionFailed):
        build_extractor(handler).extract("text", date(2026, 11, 9))


@pytest.mark.parametrize("stop_reason", ["refusal", "max_tokens"])
def test_unusable_stop_reasons_become_extraction_failed(stop_reason):
    extractor = build_extractor(
        lambda request: httpx2.Response(
            200, json=message_json(json.dumps(ANSWER), stop_reason=stop_reason)
        )
    )

    with pytest.raises(ExtractionFailed):
        extractor.extract("text", date(2026, 11, 9))


def test_answer_that_breaks_the_schema_becomes_extraction_failed():
    # Missing fields: the structured output was not respected.
    extractor = build_extractor(
        lambda request: httpx2.Response(200, json=message_json('{"company": "Acme"}'))
    )

    with pytest.raises(ExtractionFailed):
        extractor.extract("text", date(2026, 11, 9))


def test_timeout_becomes_extraction_timed_out():
    def handler(request):
        raise httpx2.ReadTimeout("too slow")

    with pytest.raises(ExtractionTimedOut):
        build_extractor(handler).extract("text", date(2026, 11, 9))


def test_a_timeout_is_still_an_extraction_failed():
    # ExtractionTimedOut is a kind of ExtractionFailed: code that catches the
    # general one keeps working.
    assert issubclass(ExtractionTimedOut, ExtractionFailed)


def test_a_timeout_is_tried_exactly_twice_with_one_retry(monkeypatch):
    # Skip the real pause between attempts, so the test is instant.
    monkeypatch.setattr(anthropic._base_client.SyncAPIClient, "_sleep_for_retry", lambda *a, **k: None)
    attempts = []

    def handler(request):
        attempts.append(request)
        raise httpx2.ReadTimeout("too slow")

    extractor = build_extractor(handler, max_retries=MODEL_MAX_RETRIES)
    with pytest.raises(ExtractionTimedOut):
        extractor.extract("text", date(2026, 11, 9))

    assert len(attempts) == 2  # the first try + one retry, never three


def test_real_client_is_configured_with_the_time_budget(monkeypatch):
    monkeypatch.setattr("app.llm.get_settings", lambda: Settings(_env_file=None, database_url="x", anthropic_api_key="k"))

    client = get_job_extractor().client

    assert client.max_retries == MODEL_MAX_RETRIES == 1
    assert client.timeout == MODEL_ATTEMPT_TIMEOUT
    # Worst case: every attempt spends its whole connect time and its whole read time,
    # plus under 1 s of pause between attempts. It must stay under the frontend's 60 s.
    per_attempt = MODEL_ATTEMPT_TIMEOUT.connect + MODEL_ATTEMPT_TIMEOUT.read
    worst_case = (MODEL_MAX_RETRIES + 1) * per_attempt + 1
    assert worst_case == 51
    assert worst_case < 60
