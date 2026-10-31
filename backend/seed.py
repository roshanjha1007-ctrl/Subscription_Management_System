import os
from datetime import datetime, timedelta, timezone

from pymongo import UpdateOne

from backend.database.collections import users_collection, products_collection, plans_collection, subscriptions_collection
from backend.database.indexes import create_indexes
from backend.security import hash_password, validate_password


def seed_demo_data():
    password = os.getenv("SEED_DEMO_PASSWORD", "")
    validate_password(password)
    create_indexes()
    now = datetime.now(timezone.utc)
    accounts = [
        (os.getenv("ADMIN_EMAIL", "admin@example.com").lower(), "Demo Admin", "admin"),
        ("staff@example.com", "Demo Staff", "staff"),
        ("customer1@example.com", "Demo Customer One", "customer"),
        ("customer2@example.com", "Demo Customer Two", "customer"),
    ]
    for email, name, role in accounts:
        users_collection.update_one(
            {"email": email},
            {"$setOnInsert": {"email": email, "name": name, "role": role, "passwordHash": hash_password(password), "createdAt": now}},
            upsert=True,
        )
    customer = users_collection.find_one({"email": "customer1@example.com"})
    product = products_collection.find_one_and_update(
        {"name": "Demo Product"},
        {"$setOnInsert": {"name": "Demo Product", "type": "service", "salesPrice": 25.0, "costPrice": 10.0, "notes": "Seeded demo product", "variants": [{"attribute": "tier", "value": "premium", "extraPrice": 5.0}], "active": True, "createdAt": now}},
        upsert=True, return_document=True,
    )
    plan = plans_collection.find_one_and_update(
        {"name": "Demo Monthly Plan"},
        {"$setOnInsert": {"name": "Demo Monthly Plan", "price": 25.0, "billingPeriod": "monthly", "minQuantity": 1, "availableFrom": now - timedelta(days=1), "autoClose": False, "closable": True, "pausable": True, "renewable": True, "active": True, "createdAt": now}},
        upsert=True, return_document=True,
    )
    if not subscriptions_collection.find_one({"subscriptionNumber": "SUB-0001"}):
        subscriptions_collection.insert_one({
            "subscriptionNumber": "SUB-0001", "customerId": str(customer["_id"]), "planId": str(plan["_id"]),
            "startDate": now, "expiryDate": None, "paymentTerms": "Due on receipt", "nextInvoiceDate": None,
            "status": "Draft", "lines": [{"productId": str(product["_id"]), "variant": {"attribute": "tier", "value": "premium"}, "quantity": 1, "unitPrice": 30.0, "tax": 0, "amount": 30.0}],
            "createdAt": now, "updatedAt": now,
        })
    print("Seeded admin, staff, two customers, demo product, plan, and SUB-0001")


if __name__ == "__main__":
    seed_demo_data()
