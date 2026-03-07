from __future__ import annotations

import os
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles

from app.core.config import get_settings
from app.core.database import init_db
from app.core.exceptions import register_exception_handlers
from app.core.logging import get_logger, setup_logging
from app.middleware.auth import setup_auth_middleware
from app.middleware.cors import setup_cors


@asynccontextmanager
async def lifespan(app: FastAPI):
    settings = get_settings()
    setup_logging(settings.app.debug)
    logger = get_logger("startup")
    logger.info("Starting AI Goat backend")
    await init_db()
    logger.info("Database initialized")

    from app.challenges.engine import init_flag_engine
    init_flag_engine(settings.app.secret_key)
    logger.info("Flag engine initialized")

    yield
    logger.info("Shutting down AI Goat backend")


app = FastAPI(title="AI Goat", lifespan=lifespan)

settings = get_settings()
setup_cors(app, settings.app.allowed_origins)
setup_auth_middleware(app)
register_exception_handlers(app)

media_dir = os.path.join(os.path.dirname(__file__), "..", "media")
if os.path.exists(media_dir):
    app.mount("/media", StaticFiles(directory=media_dir), name="media")

from app.api.admin import router as admin_router
from app.api.auth import router as auth_router
from app.api.challenge_chat import router as challenge_chat_router
from app.api.challenges import router as challenge_router
from app.api.chat import router as chat_router
from app.api.labs import router as lab_router
from app.api.profile import router as profile_router
from app.api.rag import router as rag_router
from app.api.shop import router as shop_router
from app.api.system import router as system_router

app.include_router(auth_router)
app.include_router(shop_router)
app.include_router(profile_router)
app.include_router(admin_router)
app.include_router(system_router)
app.include_router(chat_router)
app.include_router(challenge_router)
app.include_router(challenge_chat_router)
app.include_router(rag_router)
app.include_router(lab_router)
