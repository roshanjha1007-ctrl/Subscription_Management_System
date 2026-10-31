#!/bin/bash
set -e

echo "Creating AI architecture..."

mkdir -p backend/ai/tests

# Package initialization
cat > backend/ai/__init__.py <<'PY'
from .orchestrator import AIOrchestrator, orchestrator

__all__ = ["AIOrchestrator", "orchestrator"]
PY

# MongoDB AI logger
cat > backend/ai/logger.py <<'PY'
from datetime import datetime, timezone

from database.collections import ai_logs_collection


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
PY

# AI orchestrator
cat > backend/ai/orchestrator.py <<'PY'
from typing import Any, Callable

from .logger import log_ai_interaction


class AIOrchestrator:
    def __init__(self, logger: Callable = log_ai_interaction):
        self.agents = {}
        self.logger = logger

    def register_agent(self, intent: str, agent: Callable):
        if not intent or not callable(agent):
            raise ValueError("A valid intent and callable agent are required")

        self.agents[intent] = agent

    def route_request(self, intent: str, payload: dict):
        if not isinstance(payload, dict):
            raise ValueError("Payload must be a dictionary")

        agent = self.agents.get(intent)

        if agent is None:
            response = {
                "success": False,
                "message": f"No agent registered for intent: {intent}",
            }
            self.logger(intent, payload, response, "not_found")
            return response

        try:
            result = agent(payload)

            response = {
                "success": True,
                "intent": intent,
                "data": result,
            }

            self.logger(intent, payload, response, "success")
            return response

        except Exception as error:
            response = {
                "success": False,
                "message": "Agent execution failed",
            }

            self.logger(
                intent,
                payload,
                response,
                "error",
                error=str(error),
            )
            return response


orchestrator = AIOrchestrator()
PY

# Request router
cat > backend/ai/router.py <<'PY'
from .orchestrator import orchestrator


def dispatch_ai_request(intent: str, payload: dict):
    return orchestrator.route_request(intent, payload)
PY

# Automated tests
cat > backend/ai/tests/test_orchestrator.py <<'PY'
import unittest

from backend.ai.orchestrator import AIOrchestrator


class TestAIOrchestrator(unittest.TestCase):
    def setUp(self):
        self.logs = []

        def fake_logger(intent, payload, response, status, error=None):
            self.logs.append({
                "intent": intent,
                "status": status,
                "error": error,
            })

        self.orchestrator = AIOrchestrator(logger=fake_logger)

    def test_successful_agent_execution(self):
        self.orchestrator.register_agent(
            "greeting",
            lambda payload: {"message": f"Hello {payload['name']}"},
        )

        result = self.orchestrator.route_request(
            "greeting",
            {"name": "Roshan"},
        )

        self.assertTrue(result["success"])
        self.assertEqual(result["data"]["message"], "Hello Roshan")
        self.assertEqual(self.logs[-1]["status"], "success")

    def test_unknown_intent(self):
        result = self.orchestrator.route_request(
            "unknown",
            {},
        )

        self.assertFalse(result["success"])
        self.assertEqual(self.logs[-1]["status"], "not_found")

    def test_agent_error(self):
        def failing_agent(payload):
            raise RuntimeError("Test failure")

        self.orchestrator.register_agent("failure", failing_agent)

        result = self.orchestrator.route_request("failure", {})

        self.assertFalse(result["success"])
        self.assertEqual(self.logs[-1]["status"], "error")

    def test_invalid_payload(self):
        with self.assertRaises(ValueError):
            self.orchestrator.route_request("greeting", "invalid")


if __name__ == "__main__":
    unittest.main()
PY

echo ""
echo "AI architecture files created."
echo "Running automated tests..."
PYTHONPATH=. python -m unittest discover -s backend/ai/tests -v

echo ""
echo "AI architecture setup and tests completed."
