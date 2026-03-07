# Contributing to AI Goat

Thank you for considering a contribution to AI Goat. This guide explains how to set up the project locally, run tests, and submit a clean pull request.

## Prerequisites

| Tool | Version | Notes |
|------|---------|-------|
| Python | 3.11+ | Backend |
| Node.js | 18+ | Frontend |
| Ollama | Latest | Local LLM (optional for non-AI changes) |
| Docker | 20+ | For full-stack validation |

## Local Setup

```bash
git clone https://github.com/AISecurityConsortium/AIGoat.git
cd AIGoat

# Backend
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
pip install pytest pytest-asyncio httpx ruff pyflakes pre-commit

# Frontend
cd frontend && npm install && cd ..

# Install pre-commit hooks
pre-commit install
```

## Running Tests Locally

**You must run these before pushing.** CI will run the same checks, and PRs that fail CI will not be merged.

### Backend

```bash
# Lint
ruff check app/ tests/ scripts/
pyflakes app/ tests/ scripts/

# Unit / integration tests
pytest tests/ -v
```

### Frontend

```bash
cd frontend
CI=true npx react-scripts build
```

The build step runs ESLint under the hood and will fail on lint errors.

### Full Stack (Docker)

```bash
cd docker
docker-compose build
```

## What the CI Pipeline Checks

Every push and pull request against `main` triggers the GitHub Actions workflow (`.github/workflows/ci.yml`), which runs these jobs in order:

1. **Backend Lint** -- `ruff check` and `pyflakes` on all Python code.
2. **Backend Tests** -- `pytest tests/` against an in-memory SQLite database.
3. **Frontend Lint & Build** -- `npx react-scripts build` with `CI=true` (fails on warnings).
4. **Docker Build** -- Validates both Dockerfiles build successfully.

All four jobs must pass before a PR can be merged.

## Pre-commit Hooks

When you run `pre-commit install`, the following hooks run automatically on every `git commit`:

- **Trailing whitespace** removal
- **End-of-file fixer** (ensures newline at end)
- **YAML/JSON syntax** validation
- **Ruff** Python linter and formatter
- **Pyflakes** unused import / variable detection

If a hook fails, the commit is blocked. Fix the issue and re-stage your changes.

## Pull Request Guidelines

1. **Branch from `main`** -- Create a feature branch (`feature/your-change` or `fix/your-fix`).
2. **Keep PRs focused** -- One logical change per PR. Split large changes into stacked PRs.
3. **Write tests** -- New backend endpoints need corresponding tests in `tests/`. Bug fixes should include a regression test.
4. **Update prompts carefully** -- Changes to files in `prompts/` affect the AI behavior. Test with all three defense levels.
5. **Don't break existing APIs** -- Frontend components depend on specific response shapes. If you change a backend endpoint, update the corresponding frontend code.
6. **No secrets** -- Never commit API keys, tokens, or credentials. Configuration goes in `config/config.yml`.
7. **No emojis in code** -- Keep code comments professional. No GPT-style phrasing.

## Code Style

- **Python**: Follow existing patterns. Use type hints. `ruff` enforces formatting.
- **JavaScript/React**: Follow existing MUI component patterns. Use functional components with hooks.
- **Commit messages**: Use imperative mood (`Add cart validation`, not `Added cart validation`). Keep the first line under 72 characters.

## Architecture Decisions

If your change involves a significant architectural decision (new dependency, schema change, new API surface), open an issue first to discuss the approach.

## Questions?

Open a GitHub issue or reach out to the maintainers.
