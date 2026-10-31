import os
from pathlib import Path

from dotenv import load_dotenv
from pymongo import MongoClient

load_dotenv(Path(__file__).resolve().parent.parent / ".env")

MONGO_URI = os.getenv("MONGO_URI")
DB_NAME = os.getenv("DB_NAME", "subscription_management")

if not MONGO_URI:
    raise ValueError("MONGO_URI is missing from backend/.env")

client = MongoClient(MONGO_URI, serverSelectionTimeoutMS=10000)

db = client[DB_NAME]

def test_connection():
    try:
        client.admin.command("ping")
        print("MongoDB Atlas connected successfully!")
        print(f"Database: {DB_NAME}")
    except Exception as error:
        print("MongoDB connection failed:", error)
        raise
