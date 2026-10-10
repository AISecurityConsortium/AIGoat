"""Shared require_admin and removal of P5 pipeline leftovers."""
from __future__ import annotations

from app.api import admin as admin_mod
from app.api import rag as rag_mod
from app.core.dependencies import require_admin
from app.defense.pipeline import DefensePipeline
from app.middleware.auth import PUBLIC_PATH_PREFIXES


def test_admin_and_rag_share_require_admin():
    assert admin_mod._require_admin is require_admin
    assert rag_mod._require_admin is require_admin


def test_legacy_pipeline_bodies_are_gone():
    assert not hasattr(DefensePipeline, "_process_input_legacy")
    assert not hasattr(DefensePipeline, "_moderate_output_legacy")


def test_feature_flags_and_features_prefixes_are_public():
    assert "/api/feature-flags" in PUBLIC_PATH_PREFIXES
    assert "/api/features" in PUBLIC_PATH_PREFIXES
