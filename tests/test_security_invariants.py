"""Security invariants separating intentional from unintentional vulnerabilities (T004).

AIGoat is deliberately vulnerable at the AI-semantic layer: prompt injection, RAG
poisoning, data leakage and weak demo credentials are the product. It must never
become vulnerable at the operating-system layer. Upcoming work adds agent tool
handlers and MCP servers, both of which execute attacker-influenced
instructions. These tests encode the boundary before all of that code exists.

The scanner uses ``ast`` rather than regular expressions so comments and string
literals do not produce false positives.

There is deliberately no exclusion or allowlist mechanism. If a guarded module needs
a forbidden construct, the module is in the wrong place -- move the code out of the
guarded directory instead of weakening the guard.
"""
from __future__ import annotations

import ast
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parent.parent

# Directories whose contents may be vulnerable only at the AI-semantic layer.
# Most do not exist yet; the scanner must tolerate that and still pass.
GUARDED_DIRS = (
    "app/mcp_servers",
    "app/surfaces",
    "app/agent",
)

FORBIDDEN_IMPORT_ROOTS = frozenset({
    "subprocess",   # host command execution
    "socket",       # raw network egress
    "httpx",        # outbound HTTP
    "requests",
    "aiohttp",
    "urllib",       # urllib.request
    "pickle",       # deserialization RCE
    "marshal",
    "shutil",       # destructive filesystem operations
    "ctypes",
    "multiprocessing",
})

FORBIDDEN_CALL_NAMES = frozenset({
    "eval",
    "exec",
    "compile",
    "__import__",
    "system",       # os.system
    "popen",        # os.popen
    "rmtree",       # shutil.rmtree
    "unlink",
    "spawnl",
    "spawnv",
    "execv",
    "execve",
})

_WHY = (
    "Shipped tool handlers and MCP servers may be vulnerable at the "
    "AI-semantic layer only, never at the OS layer. See SECURITY.md and "
    "agent-docs/INTENTIONAL_VULNERABILITY_NOTICE.md. Do not add an allowlist entry -- "
    "move the code out of the guarded directory instead."
)


def _guarded_files() -> list[Path]:
    files: list[Path] = []
    for rel in GUARDED_DIRS:
        directory = ROOT / rel
        if directory.exists():
            files.extend(sorted(directory.rglob("*.py")))
    services = ROOT / "app" / "services"
    if services.exists():
        files.extend(sorted(services.glob("*_tools.py")))
    return files


def _violations(source: str, filename: str) -> list[str]:
    """Return a list of human-readable violations found in one module."""
    found: list[str] = []
    tree = ast.parse(source, filename=filename)
    for node in ast.walk(tree):
        if isinstance(node, ast.Import):
            for alias in node.names:
                root = alias.name.split(".")[0]
                if root in FORBIDDEN_IMPORT_ROOTS:
                    found.append(f"forbidden import '{alias.name}'")
        elif isinstance(node, ast.ImportFrom):
            if node.module:
                root = node.module.split(".")[0]
                if root in FORBIDDEN_IMPORT_ROOTS:
                    found.append(f"forbidden import from '{node.module}'")
        elif isinstance(node, ast.Call):
            name = getattr(node.func, "id", None) or getattr(node.func, "attr", None)
            if name in FORBIDDEN_CALL_NAMES:
                found.append(f"forbidden call '{name}()'")
    return found


# ---------------------------------------------------------------------------
# Self-test: prove the scanner can actually fail.
# ---------------------------------------------------------------------------

def test_scanner_detects_planted_violations():
    planted = (
        "import subprocess\n"
        "import os\n"
        "def run(cmd):\n"
        "    os.system(cmd)\n"
        "    eval(cmd)\n"
    )
    found = _violations(planted, "<planted>")
    assert any("subprocess" in v for v in found)
    assert any("system()" in v for v in found)
    assert any("eval()" in v for v in found)


def test_scanner_ignores_forbidden_names_in_comments_and_strings():
    benign = (
        "# we deliberately never call os.system here\n"
        "MESSAGE = 'do not use eval() or subprocess'\n"
        "def safe():\n"
        "    return MESSAGE\n"
    )
    assert _violations(benign, "<benign>") == []


def test_guard_configuration_is_not_empty():
    """A scanner that scans nothing would pass silently forever."""
    assert GUARDED_DIRS, "GUARDED_DIRS must not be empty"
    assert FORBIDDEN_IMPORT_ROOTS, "FORBIDDEN_IMPORT_ROOTS must not be empty"
    assert FORBIDDEN_CALL_NAMES, "FORBIDDEN_CALL_NAMES must not be empty"


# ---------------------------------------------------------------------------
# The invariant itself.
# ---------------------------------------------------------------------------

@pytest.mark.parametrize(
    "path",
    _guarded_files(),
    ids=lambda p: str(p.relative_to(ROOT)),
)
def test_no_os_layer_sinks_in_guarded_modules(path: Path):
    found = _violations(path.read_text(), str(path))
    assert not found, f"{path.relative_to(ROOT)}: {'; '.join(found)}. {_WHY}"


# ---------------------------------------------------------------------------
# Authorization: every admin route must gate on _require_admin.
# ---------------------------------------------------------------------------

def _route_functions(tree: ast.AST) -> list[ast.AsyncFunctionDef | ast.FunctionDef]:
    routes = []
    for node in ast.walk(tree):
        if not isinstance(node, (ast.AsyncFunctionDef, ast.FunctionDef)):
            continue
        for dec in node.decorator_list:
            target = dec.func if isinstance(dec, ast.Call) else dec
            if isinstance(target, ast.Attribute) and isinstance(target.value, ast.Name):
                if target.value.id == "router":
                    routes.append(node)
                    break
    return routes


def test_every_admin_route_requires_admin():
    admin_py = ROOT / "app" / "api" / "admin.py"
    tree = ast.parse(admin_py.read_text(), filename=str(admin_py))
    routes = _route_functions(tree)
    assert routes, "no router-decorated functions found in app/api/admin.py"

    unguarded = []
    for fn in routes:
        calls = {
            getattr(n.func, "id", None) or getattr(n.func, "attr", None)
            for n in ast.walk(fn)
            if isinstance(n, ast.Call)
        }
        if "_require_admin" not in calls:
            unguarded.append(fn.name)

    assert not unguarded, (
        f"admin routes missing _require_admin: {unguarded}. Every route in "
        f"app/api/admin.py must enforce admin authorization."
    )


def test_admin_delete_on_knowledge_base_requires_admin():
    """The one admin-gated route outside admin.py, per CODEBASE_MAP section 3.2."""
    rag_py = ROOT / "app" / "api" / "rag.py"
    tree = ast.parse(rag_py.read_text(), filename=str(rag_py))
    for fn in _route_functions(tree):
        is_delete = any(
            isinstance(d, ast.Call)
            and isinstance(d.func, ast.Attribute)
            and d.func.attr == "delete"
            for d in fn.decorator_list
        )
        if is_delete:
            calls = {
                getattr(n.func, "id", None) or getattr(n.func, "attr", None)
                for n in ast.walk(fn)
                if isinstance(n, ast.Call)
            }
            assert "_require_admin" in calls, (
                f"{fn.name} deletes knowledge-base data and must call _require_admin"
            )


# ---------------------------------------------------------------------------
# No SQL built by string interpolation anywhere in app/.
# ---------------------------------------------------------------------------

def test_no_sql_text_built_from_interpolation():
    offenders: list[str] = []
    for path in sorted((ROOT / "app").rglob("*.py")):
        tree = ast.parse(path.read_text(), filename=str(path))
        for node in ast.walk(tree):
            if not isinstance(node, ast.Call):
                continue
            name = getattr(node.func, "id", None) or getattr(node.func, "attr", None)
            if name != "text" or not node.args:
                continue
            arg = node.args[0]
            if isinstance(arg, (ast.JoinedStr, ast.BinOp)):
                offenders.append(f"{path.relative_to(ROOT)}:{node.lineno}")
            elif isinstance(arg, ast.Call):
                inner = getattr(arg.func, "attr", None)
                if inner == "format":
                    offenders.append(f"{path.relative_to(ROOT)}:{node.lineno}")
    assert not offenders, (
        f"SQL text() built by interpolation at {offenders}. Use bound parameters. "
        f"SQL injection is an unintentional vulnerability and is out of scope for "
        f"this platform's intentional weaknesses."
    )
