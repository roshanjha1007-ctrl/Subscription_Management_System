from datetime import datetime, timezone

from backend.database.collections import ai_logs_collection


def log_ai_interaction(intent, payload, response, status, error=None):
    document = {
        "intent": intent,
        "request": payload,
        "response": response,
        "status": status,
        "error": error,
        "created_at": datetime.now(timezone.utc),
    }

    result = ai_logs_collection.insert_one(document)
    return str(result.inserted_id)
