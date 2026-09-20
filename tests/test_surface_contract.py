"""Surface registry, transcript schema, and chat.cracky execute (P6)."""
from __future__ import annotations

from app.challenges.evaluator import EvalContext
from app.surfaces import ensure_registered
from app.surfaces.registry import all_surfaces, get_surface
from app.surfaces.transcript import EVENT_TYPES, Event, Transcript, validate_event


def test_registered_surfaces_implement_the_contract():
    ensure_registered()
    ids = {s.id for s in all_surfaces()}
    assert ids == {"chat.cracky", "rag.kb", "api.raw", "agent.runner", "mcp.client", "skill.runtime"}
    for surface in all_surfaces():
        schema = surface.config_schema()
        assert isinstance(schema, dict)
        assert schema.get("type") == "object"
        assert hasattr(surface, "execute")
        assert surface.name
        assert surface.ui


def test_unknown_surface_raises_keyerror_naming_the_id():
    ensure_registered()
    try:
        get_surface("not.a.surface")
    except KeyError as exc:
        assert "not.a.surface" in str(exc)
    else:
        raise AssertionError("expected KeyError")


def test_transcript_event_schema():
    t = Transcript()
    t.add("user_message", content="cleaned", raw="raw")
    t.add("model_output", content="out", raw="out")
    api = t.to_api()
    assert [e["type"] for e in api] == ["user_message", "model_output"]
    assert api[0]["seq"] == 0
    assert api[1]["seq"] == 1
    for payload in api:
        validate_event(payload)
        assert payload["type"] in EVENT_TYPES
        assert "ts" in payload


def test_user_message_and_model_output_carry_raw():
    event = Event(kind="user_message", data={"content": "hi"}, seq=0, ts="t", raw="RAW")
    payload = event.to_api()
    validate_event(payload)
    assert payload["raw"] == "RAW"
    assert payload["content"] == "hi"


def test_unknown_event_type_is_rejected():
    t = Transcript()
    try:
        t.add("not_an_event")
    except ValueError as exc:
        assert "not_an_event" in str(exc)
    else:
        raise AssertionError("expected ValueError")


def test_validate_event_requires_raw_on_user_message():
    try:
        validate_event({"seq": 0, "type": "user_message", "ts": "t", "content": "x"})
    except ValueError as exc:
        assert "raw" in str(exc)
    else:
        raise AssertionError("expected ValueError")


def test_eval_context_transcript_defaults_empty_and_is_ignored():
    ctx = EvalContext(user_message="hi", model_output="hello")
    assert ctx.transcript == []
    from app.challenges.evaluators.prompt_injection import PromptInjectionEvaluator

    assert PromptInjectionEvaluator().check_exploit(ctx) is False
