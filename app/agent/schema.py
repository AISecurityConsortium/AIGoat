"""JSON-schema validation and one type-coercion repair for tool arguments."""
from __future__ import annotations

from typing import Any


def as_json_schema(parameter_schema: dict[str, Any] | None) -> dict[str, Any]:
    """Accept either a full object schema or a bare properties mapping."""
    raw = dict(parameter_schema or {})
    if raw.get("type") == "object" and "properties" in raw:
        schema = dict(raw)
        schema.setdefault("additionalProperties", False)
        return schema
    return {
        "type": "object",
        "properties": raw,
        "additionalProperties": False,
    }


def _coerce(expected: str, value: Any) -> tuple[Any, bool] | tuple[None, None]:
    """Return (coerced, repaired) or (None, None) when coercion is impossible."""
    if expected == "integer":
        if isinstance(value, bool):
            return None, None
        if isinstance(value, int):
            return value, False
        if isinstance(value, float) and value.is_integer():
            return int(value), True
        if isinstance(value, str) and value.strip().lstrip("-").isdigit():
            return int(value.strip()), True
        return None, None
    if expected == "number":
        if isinstance(value, bool):
            return None, None
        if isinstance(value, (int, float)):
            return float(value), False
        if isinstance(value, str):
            try:
                return float(value.strip()), True
            except ValueError:
                return None, None
        return None, None
    if expected == "string":
        if isinstance(value, str):
            return value, False
        if isinstance(value, (int, float, bool)):
            return str(value), True
        return None, None
    if expected == "boolean":
        if isinstance(value, bool):
            return value, False
        if isinstance(value, str) and value.strip().lower() in {"true", "false"}:
            return value.strip().lower() == "true", True
        if value in (0, 1):
            return bool(value), True
        return None, None
    return value, False


def validate_and_repair(
    schema: dict[str, Any],
    arguments: dict[str, Any] | None,
) -> tuple[dict[str, Any] | None, str | None, bool]:
    """Validate ``arguments`` against ``schema``.

    Type mismatches are coerced once (the Intent Gate repair). Missing required
    fields, extra fields, and values that cannot be coerced return an error
    string and ``None`` args. Never raises.
    """
    args = dict(arguments or {})
    properties = schema.get("properties") or {}
    required = list(schema.get("required") or [])
    additional = schema.get("additionalProperties", False)
    repaired = False

    extra = [key for key in args if key not in properties]
    if extra and additional is False:
        return None, f"unexpected argument(s): {', '.join(sorted(extra))}", False

    out: dict[str, Any] = {}
    for name, spec in properties.items():
        expected = str((spec or {}).get("type") or "string")
        if name not in args:
            if name in required:
                return None, f"missing required argument {name!r}", False
            continue
        coerced, did_repair = _coerce(expected, args[name])
        if did_repair is None:
            return None, f"argument {name!r} is not a valid {expected}", False
        if did_repair:
            repaired = True
        out[name] = coerced

    for name in required:
        if name not in out:
            return None, f"missing required argument {name!r}", False
    return out, None, repaired
