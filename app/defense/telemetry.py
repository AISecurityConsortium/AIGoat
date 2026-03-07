from __future__ import annotations

import asyncio

from app.core.logging import get_logger

logger = get_logger(__name__)


class TelemetryLogger:
    async def log(
        self,
        user_id: int | None,
        level: int,
        message: str,
        intent: str | None,
        action: str,
        reason: str | None = None,
    ) -> None:
        log_data = {
            "user_id": user_id,
            "defense_level": level,
            "msg_preview": message[:200],
            "intent": intent,
            "action": action,
            "reason": reason,
        }
        logger.info("defense_telemetry %s", log_data)
        asyncio.create_task(self._write_to_db(log_data))

    async def _write_to_db(self, data: dict) -> None:
        """Persist a telemetry row. Fully fail-safe: any exception is
        logged and swallowed so it never blocks the request path."""
        try:
            from app.core.database import async_session
            from app.models.telemetry import DefenseTelemetry

            async with async_session() as session:
                row = DefenseTelemetry(
                    user_id=data.get("user_id"),
                    defense_level=data["defense_level"],
                    message=data.get("msg_preview", ""),
                    intent_classification=data.get("intent"),
                    action=data["action"],
                )
                session.add(row)
                await session.commit()
        except Exception as exc:
            logger.warning("Telemetry DB write failed (non-blocking): %s", exc)
