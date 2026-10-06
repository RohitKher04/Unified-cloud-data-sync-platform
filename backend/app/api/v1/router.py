from fastapi import APIRouter

from app.api.v1 import auth, users, integrations

api_router = APIRouter()
api_router.include_router(auth.router, prefix="/auth", tags=["Auth"])
api_router.include_router(users.router, prefix="/users", tags=["Users"])
api_router.include_router(integrations.router, prefix="/integrations", tags=["Integrations"])