# Subscription_Management_System# Subscription Management System

We are building a Subscription Management System to manage subscriptions, products, billing, invoices and payments in one place.

The main goal of this project is to make subscription management easier and more organised. Along with the core system, we also plan to integrate Multi-Agent AI to make it easier for users to interact with different parts of the platform.

## What We Plan to Build

- User registration, login and role-based access.
- Product and subscription plan management.
- Create, manage, pause, renew and close subscriptions.
- Automatic invoice generation and billing.
- Payment tracking and outstanding balance management.
- Discount management.
- Financial reports and summaries.
- AI-powered assistance through multiple specialised agents.

## Multi-Agent AI

We plan to build multiple AI agents, each responsible for a specific part of the system.

- **Subscription Agent:** Helps with subscription-related queries.
- **Billing Agent:** Assists with invoices and billing.
- **Finance Agent:** Provides information about payments, revenue and outstanding amounts.
- **Customer Support Agent:** Helps users with general platform-related queries.

A central AI orchestrator will manage these agents and direct requests to the appropriate one.

## Technology Stack

- **Frontend:** React.js
- **Backend:** Python
- **Database:** MongoDB

Additional libraries and AI technologies will be decided during development.

## Team

- **Roshan Jha** — Database and AI Architecture
- **Yash Kulshrestha** — Backend Development
- **Rohit** — Billing and Finance
- **Yatharth Saini** — Frontend Development and Integration

## Development

We are currently setting up the project structure and dividing responsibilities among team members. Development will begin with the core subscription management features, followed by AI agent integration and testing.

More features and improvements will be added as the project progresses.

---

*Developed collaboratively by our team.*

## Core backend

The FastAPI core API lives in `backend/` and uses the existing MongoDB collections.

```powershell
Copy-Item backend/.env.example backend/.env
# Set MONGO_URI and JWT_SECRET in backend/.env
pip install -r backend/requirements.txt
python -m backend.seed
uvicorn backend.main:app --reload
```

Run the backend checks in PowerShell with `$env:PYTHONPATH = "backend"` then `python -m unittest backend.tests.test_core backend.ai.tests.test_orchestrator backend.ai.tests.test_finance_agent`. For a real seeded demo pass against local MongoDB, run `python -m backend.tests.live_smoke`; it starts and stops a local API process and advances seeded `SUB-0001` to `Active`.

The API is available at `http://127.0.0.1:8000`; `/health` is a database-independent health check. Seed accounts use `SEED_DEMO_PASSWORD` from `backend/.env`; the default seeded emails are `admin@example.com`, `staff@example.com`, `customer1@example.com`, and `customer2@example.com`.

### API contract

- `POST /api/auth/register` `{name,email,password}`; `POST /api/auth/login` returns `{token,tokenType,user}`. Send `Authorization: Bearer <token>` to authenticated routes.
- `GET /api/auth/me`; `POST /api/auth/staff` `{name,email,password}` (admin only).
- Products: `POST /api/products`, `GET /api/products?page=1&limit=20`, `GET /api/products/{id}`, `PUT /api/products/{id}`. Product variants use `{attribute,value,extraPrice}`.
- Plans: `POST /api/plans`, `GET /api/plans`, `GET /api/plans/{id}`, `PUT /api/plans/{id}`. Billing periods are `daily`, `weekly`, `monthly`, or `yearly`.
- Subscriptions: `POST /api/subscriptions` with `{customerId,planId,startDate,expiryDate?,paymentTerms?,lines:[{productId,variant?,quantity,tax?}]}`; `GET /api/subscriptions?status=Active&page=1&limit=20`; `GET /api/subscriptions/{id-or-number}`; `PATCH /api/subscriptions/{id-or-number}/status` with `{status}`.
- Subscription status sequence: `Draft` → `Quotation` → `Confirmed` → `Active` → `Closed`. Only admin and staff create subscriptions or change status. Customers can list and read only their own.
- Internal agent intents `list_subscriptions` and `get_subscription` accept `user_context: {id,role}` and call the same role-filtered service layer.

`salesPrice` plus a matching variant's `extraPrice` is the line unit price. Invoices can import `get_variant_price` from `backend.services`. Passwords are bcrypt hashes; tokens are signed HS256 JWTs and expire after 24 hours. Keep `.env` local and rotate the example JWT secret before deployment.
