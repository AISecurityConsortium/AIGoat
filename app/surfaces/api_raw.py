"""api.raw stub. Thin authenticated passthrough lands with later lab content."""
from __future__ import annotations

from typing import Any

from app.core.exceptions import SurfaceNotReadyError
from app.surfaces.base import SurfaceRequest, SurfaceResult, TargetSurface


class ApiRawSurface(TargetSurface):
    id = "api.raw"
    name = "Raw authenticated API"
    ui = "api"
    capabilities = ("execute",)

    def config_schema(self) -> dict[str, Any]:
        return {
            "type": "object",
            "properties": {
                "path": {"type": "string"},
            },
            "additionalProperties": True,
        }

    def availability(self) -> tuple[bool, str | None]:
        return False, "API passthrough execute is not built yet"

    async def execute(self, req: SurfaceRequest) -> SurfaceResult:
        raise SurfaceNotReadyError(self.id, "API passthrough execute is not built yet")
