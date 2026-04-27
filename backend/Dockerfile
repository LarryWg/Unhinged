FROM python:3.11-slim

WORKDIR /app

COPY pyproject.toml .
COPY uv.lock .

RUN pip install uv && uv sync --no-dev --frozen

COPY . .

CMD .venv/bin/uvicorn main:app --host 0.0.0.0 --port ${PORT:-8000}