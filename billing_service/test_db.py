import asyncio
from app.database import connect_to_mongodb, close_mongodb_connection

async def main():
    try:
        await connect_to_mongodb()
        print("MongoDB connection test: SUCCESS")
    except Exception as error:
        print("MongoDB connection test: FAILED")
        print(type(error).__name__, str(error))
    finally:
        await close_mongodb_connection()

if __name__ == "__main__":
    asyncio.run(main())
