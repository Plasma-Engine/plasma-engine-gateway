# Plasma Engine Gateway

FastAPI-based API gateway providing authentication, routing, and shared cross-service APIs for the Plasma Engine platform.

## Status

- Stack: Python 3.11, FastAPI, SQLModel
- CI: [Reusable lint/test workflow](.github/workflows/ci.yml)
- Issue templates, PR template, and CODEOWNERS synced from `plasma-engine-shared`

## Getting Started

```bash
git clone https://github.com/xkonjin/plasma-engine-gateway.git
cd plasma-engine-gateway

python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt  # placeholder until scaffolding lands
```

## Development Checklist

- [ ] Link issues to Program board
- [ ] Run `make lint` / `pytest` before committing
- [ ] Add/Update documentation for new endpoints
- [ ] Ensure CodeRabbit + human review on PRs

See the [Development Handbook](../plasma-engine-shared/docs/development-handbook.md) for environment setup.
