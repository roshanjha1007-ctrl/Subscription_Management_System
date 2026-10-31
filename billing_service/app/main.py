from contextlib import asynccontextmanager

from fastapi import FastAPI

from app.config import settings
from app.database import connect_to_mongodb, close_mongodb_connection
from app.routes.finance_routes import router as finance_router


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Connect only when MongoDB credentials are available.
    if settings.mongodb_url and settings.database_name:
        await connect_to_mongodb()
    else:
        print("MongoDB credentials pending. Running without database.")

    yield

    await close_mongodb_connection()


app = FastAPI(
    title="Billing and Finance API",
    description="Invoice, payment and financial management service",
    version="1.0.0",
    lifespan=lifespan
)


# Register Finance API routes.
app.include_router(finance_router)


@app.get("/")
async def root():
    return {
        "message": "Billing and Finance API is running",
        "module": "Billing + Finance"
    }


@app.get("/health")
async def health():
    return {"status": "healthy"}