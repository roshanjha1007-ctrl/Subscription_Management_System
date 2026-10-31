from contextlib import asynccontextmanager

from fastapi import FastAPI

from backend.database.connection import test_connection
from backend.database.indexes import create_indexes

@asynccontextmanager
async def lifespan(app):
    test_connection()
    create_indexes()
    yield


app = FastAPI(title="Subscription Management API", version="1.0.0", lifespan=lifespan)

@app.get("/")
def root():
    return {"message": "Subscription Management API is running"}

@app.get("/health")
def health():
    return {"status": "healthy"}

from backend.api import router

app.include_router(router, prefix="/api")

if __name__ == "__main__":
    test_connection()
    create_indexes()
