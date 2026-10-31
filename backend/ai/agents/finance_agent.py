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
