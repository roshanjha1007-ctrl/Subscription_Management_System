# AI Architecture – Subscription Management System

## 1. Overview
The AI architecture provides centralized intent-based request routing,
finance agent execution, and AI request logging.

## 2. Database Foundation
MongoDB Atlas database: subscription_management

Collections:
- users
- products
- plans
- subscriptions
- invoices
- payments
- discounts
- ai_logs

A unique index is configured on users.email.

## 3. AI Components
- orchestrator.py: Registers agents and routes requests by intent.
- router.py: Provides the dispatch_ai_request wrapper.
- logger.py: Stores AI request and response logs in MongoDB.
- agents/finance_agent.py: Connects finance agents to the Billing API.

## 4. Finance Agent Integration
The finance agent communicates with the existing Billing API using HTTP.

Supported intents:
- finance_summary
- finance_outstanding
- finance_overdue

Supported endpoints:
- GET /api/finance/summary
- GET /api/finance/outstanding
- GET /api/finance/overdue

## 5. AI Logging
AI logs are stored in the ai_logs collection.

Logged information includes:
- Intent
- Request payload
- Response
- Status
- Error
- UTC creation timestamp

## 6. Error Handling
The orchestrator handles invalid payloads, unknown intents, and agent execution errors.
Unsupported finance endpoints are rejected.

## 7. Testing
Run from the project root:

PYTHONPATH=backend backend/.venv/bin/python -m unittest discover -s backend/ai/tests -v

The current test suite contains 8 passing unit tests.

## 8. Integration Verification
The three finance intents have been tested against the running Billing API.
All three returned successful responses.

The current finance responses contain zero totals and empty lists because
matching billing records have not yet been populated in the database.

MongoDB Atlas AI logging was also verified with stored records.
