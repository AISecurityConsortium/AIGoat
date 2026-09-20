"""Register DefenseControl implementations.

Importing this package populates the T060 registry. ``ensure_registered`` is
idempotent so tests can ``reset_controls()`` and load profiles again.
"""
from __future__ import annotations

from app.defense.control import get_control, register_control
from app.defense.controls.input_validate import InputValidateControl
from app.defense.controls.intent_classify import IntentClassifyControl
from app.defense.controls.mcp_description_scan import McpDescriptionScanControl
from app.defense.controls.mcp_tool_pin import McpToolPinControl
from app.defense.controls.output_moderate import OutputModerateControl
from app.defense.controls.rails_nemo import RailsNemoControl
from app.defense.controls.retrieval_acl import RetrievalAclControl
from app.defense.controls.retrieval_injection_scan import RetrievalInjectionScanControl
from app.defense.controls.retrieval_provenance import RetrievalProvenanceControl
from app.defense.controls.skill_allowlist import SkillAllowlistControl
from app.defense.controls.skill_hash_pin import SkillHashPinControl
from app.defense.controls.skill_scan import SkillScanControl
from app.defense.controls.tool_allowlist import ToolAllowlistControl
from app.defense.controls.tool_approval import ToolApprovalControl


def _register_if_missing(control) -> None:
    try:
        get_control(control.id)
    except KeyError:
        register_control(control)


def ensure_registered() -> None:
    _register_if_missing(InputValidateControl())
    _register_if_missing(IntentClassifyControl())
    _register_if_missing(OutputModerateControl())
    _register_if_missing(RailsNemoControl())
    _register_if_missing(RetrievalProvenanceControl())
    _register_if_missing(RetrievalAclControl())
    _register_if_missing(RetrievalInjectionScanControl())
    _register_if_missing(ToolAllowlistControl())
    _register_if_missing(ToolApprovalControl())
    _register_if_missing(McpToolPinControl())
    _register_if_missing(McpDescriptionScanControl())
    _register_if_missing(SkillAllowlistControl())
    _register_if_missing(SkillHashPinControl())
    _register_if_missing(SkillScanControl())


ensure_registered()
