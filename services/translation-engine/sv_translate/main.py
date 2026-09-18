"""ASGI entry point: uvicorn sv_translate.main:app"""

from .app import create_app

app = create_app()
