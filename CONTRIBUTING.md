# Contributing to AI Goat

Thank you for considering a contribution to AI Goat. This guide explains how to contribute, set up the project locally, run tests, and submit a clean pull request.

## How to Contribute

There are many ways to help improve AI Goat:

- **Improve the platform** — Fix bugs, optimize performance, or add new features to the backend or frontend
- **Add defensive techniques** — Contribute new guardrails, detection methods, or hardening strategies
- **Report bugs** — Found something broken? Open an issue with reproduction steps
- **Suggest new lab ideas** — Have an idea for a new attack scenario or OWASP mapping? We'd love to hear it
- **Improve documentation** — Clarify instructions, fix typos, or expand explanations
- **Add educational examples** — Contribute new walkthroughs, workshop exercises, or training scenarios

## Contribution Scope

Contributions can span different areas of the project:

- **Code improvements** — Backend (Python/FastAPI), frontend (React/MUI), infrastructure (Docker, scripts)
- **Documentation improvements** — README, workshop guides, challenge walkthroughs, inline code docs
- **Educational content** — New lab prompts, challenge ideas, defensive technique examples

Each area has its own licensing (see [Licensing of Contributions](#licensing-of-contributions) below).

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

## Pull Request Process

1. **Fork the repository** and clone it locally
2. **Create a feature branch** from `main` (`feature/your-change` or `fix/your-fix`)
3. **Make your changes** and verify they pass all tests and linting (see above)
4. **Submit a pull request** against `main` with a clear description of what you changed and why
5. **Maintainers review** — expect feedback or approval within a reasonable timeframe

## Pull Request Guidelines

1. **Keep PRs focused** -- One logical change per PR. Split large changes into stacked PRs.
2. **Write tests** -- New backend endpoints need corresponding tests in `tests/`. Bug fixes should include a regression test.
3. **Update prompts carefully** -- Changes to files in `prompts/` affect the AI behavior. Test with all three defense levels.
4. **Don't break existing APIs** -- Frontend components depend on specific response shapes. If you change a backend endpoint, update the corresponding frontend code.
5. **No secrets** -- Never commit API keys, tokens, or credentials. Configuration goes in `config/config.yml`.
6. **No emojis in code** -- Keep code comments professional. No GPT-style phrasing.

## Code Style

- **Python**: Follow existing patterns. Use type hints. `ruff` enforces formatting.
- **JavaScript/React**: Follow existing MUI component patterns. Use functional components with hooks.
- **Commit messages**: Use imperative mood (`Add cart validation`, not `Added cart validation`). Keep the first line under 72 characters.

## Architecture Decisions

If your change involves a significant architectural decision (new dependency, schema change, new API surface), open an issue first to discuss the approach.

## Licensing of Contributions

By submitting a contribution, you agree that it will be licensed under the same terms as the rest of the project:

- **Code contributions** (to `app/`, `frontend/`, `guardrails/`, `scripts/`, `docker/`, `config/config.yml`) are accepted under the **Apache License 2.0**
- **Training content contributions** (to `prompts/`, `docs/`, `media/`, `config/labs.yml`) are accepted under **Creative Commons BY-NC-SA 4.0**

This keeps the project licensing consistent. See [TRAINING_LICENSE.md](TRAINING_LICENSE.md) for details on the training content license.

## Questions?

Open a GitHub issue or reach out to the maintainers. See [GOVERNANCE.md](GOVERNANCE.md) for information about the project maintainers and decision-making process.
