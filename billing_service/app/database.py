
from pymongo import AsyncMongoClient
from app.config import settings

client = None
database = None


async def connect_to_mongodb():
    global client, database

    if not settings.mongodb_url or not settings.database_name:
        raise RuntimeError(
            "MongoDB credentials are missing. "
            "Please configure billing_service/.env"
        )

    client = AsyncMongoClient(
        settings.mongodb_url,
        serverSelectionTimeoutMS=5000
    )

    await client.admin.command("ping")

    database = client[settings.database_name]

    print("MongoDB Atlas connected successfully!")


async def close_mongodb_connection():
    global client, database

    if client is not None:
        await client.close()
        client = None
        database = None


def get_database():
    if database is None:
        raise RuntimeError("Database is not connected")

    return database
