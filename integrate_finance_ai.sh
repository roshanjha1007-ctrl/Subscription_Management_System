#!/bin/bash
set -e

echo "Setting up Finance Agent integration..."

mkdir -p backend/ai/agents backend/ai/tests

cat > backend/ai/agents/__init__.py <<'PY'
from .finance_agent import (
    finance_summary_agent,
    finance_outstanding_agent,
    finance_overdue_agent,
)

__all__ = [
    "finance_summary_agent",
    "finance_outstanding_agent",
    "finance_overdue_agent",
]
PY

cat > backend/ai/agents/finance_agent.py <<'PY'
import os
from pathlib import Path

import httpx
from dotenv import load_dotenv

BACKEND_DIR = Path(__file__).resolve().parents[2]
load_dotenv(BACKEND_DIR / ".env")

BILLING_API_BASE_URL = os.getenv(
    "BILLING_API_BASE_URL",
    "http://127.0.0.1:8001"
).rstrip("/")

TIMEOUT = 10.0


def fetch_finance_data(endpoint: str):
    allowed_endpoints = {
        "summary",
        "outstanding",
        "overdue",
    }

    if endpoint not in allowed_endpoints:
        raise ValueError("Unsupported finance endpoint")

    url = f"{BILLING_API_BASE_URL}/api/finance/{endpoint}"

    response = httpx.get(url, timeout=TIMEOUT)
    response.raise_for_status()

    return response.json()


def finance_summary_agent(payload: dict):
    return fetch_finance_data("summary")


def finance_outstanding_agent(payload: dict):
    return fetch_finance_data("outstanding")


def finance_overdue_agent(payload: dict):
    return fetch_finance_data("overdue")
PY

cat > backend/ai/orchestrator.py <<'PY'
from typing import Callable

from .logger import log_ai_interaction
from .agents import (
    finance_summary_agent,
    finance_outstanding_agent,
    finance_overdue_agent,
)


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

orchestrator.register_agent("finance_summary", finance_summary_agent)
orchestrator.register_agent("finance_outstanding", finance_outstanding_agent)
orchestrator.register_agent("finance_overdue", finance_overdue_agent)
PY

cat > backend/ai/tests/test_finance_agent.py <<'PY'
import unittest
from unittest.mock import Mock, patch

from ai.agents.finance_agent import (
    fetch_finance_data,
    finance_summary_agent,
    finance_outstanding_agent,
    finance_overdue_agent,
)


class TestFinanceAgent(unittest.TestCase):

    @patch("ai.agents.finance_agent.httpx.get")
    def test_summary_endpoint(self, mock_get):
        mock_response = Mock()
        mock_response.json.return_value = {"total_outstanding": "0.00"}
        mock_get.return_value = mock_response

        result = finance_summary_agent({})

        self.assertEqual(result, {"total_outstanding": "0.00"})
        mock_get.assert_called_once()
        mock_response.raise_for_status.assert_called_once()

    @patch("ai.agents.finance_agent.httpx.get")
    def test_outstanding_endpoint(self, mock_get):
        mock_response = Mock()
        mock_response.json.return_value = []
        mock_get.return_value = mock_response

        self.assertEqual(finance_outstanding_agent({}), [])

    @patch("ai.agents.finance_agent.httpx.get")
    def test_overdue_endpoint(self, mock_get):
        mock_response = Mock()
        mock_response.json.return_value = []
        mock_get.return_value = mock_response

        self.assertEqual(finance_overdue_agent({}), [])

    def test_rejects_unsupported_endpoint(self):
        with self.assertRaises(ValueError):
            fetch_finance_data("delete_everything")


if __name__ == "__main__":
    unittest.main()
PY

if ! grep -qx 'httpx' backend/requirements.txt; then
    echo 'httpx' >> backend/requirements.txt
fi

echo ""
echo "Running AI tests..."
PYTHONPATH=backend backend/.venv/bin/python -m unittest discover -s backend/ai/tests -v

echo ""
echo "Checking registered Finance Agent intents..."
PYTHONPATH=backend backend/.venv/bin/python - <<'PY'
from ai.orchestrator import orchestrator

print("Registered intents:")
for intent in orchestrator.agents:
    print("-", intent)

expected = {
    "finance_summary",
    "finance_outstanding",
    "finance_overdue",
}

assert expected.issubset(orchestrator.agents.keys())
print("Finance Agent registration successful.")
PY

echo ""
echo "Finance Agent integration files created successfully."
