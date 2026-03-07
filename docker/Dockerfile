FROM python:3.11

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY app/ ./app/
COPY scripts/ ./scripts/
COPY config/ ./config/
COPY prompts/ ./prompts/
COPY guardrails/ ./guardrails/
COPY media/ ./media/
COPY docker/docker-entrypoint.sh ./docker-entrypoint.sh

RUN chmod +x docker-entrypoint.sh

EXPOSE 8000

CMD ["bash", "docker-entrypoint.sh"]
