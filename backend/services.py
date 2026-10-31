from datetime import datetime, timezone

from bson import ObjectId
from fastapi import HTTPException

from backend.database.collections import (
    plans_collection, products_collection, subscriptions_collection, users_collection,
)

STATUSES = ("Draft", "Quotation", "Confirmed", "Active", "Closed")
TRANSITIONS = {
    "Draft": ("Quotation",), "Quotation": ("Confirmed",),
    "Confirmed": ("Active",), "Active": ("Closed",), "Closed": (),
}


def json_safe(value):
    if isinstance(value, ObjectId):
        return str(value)
    if isinstance(value, datetime):
        return value.isoformat()
    if isinstance(value, dict):
        return {("id" if key == "_id" else key): json_safe(item) for key, item in value.items() if key != "passwordHash"}
    if isinstance(value, list):
        return [json_safe(item) for item in value]
    return value


def page_args(page, limit):
    if page < 1 or limit < 1 or limit > 100:
        raise HTTPException(400, "page must be positive and limit must be between 1 and 100")
    return (page - 1) * limit


def object_id(value):
    if not ObjectId.is_valid(str(value)):
        raise HTTPException(404, "Record not found")
    return ObjectId(str(value))


def paged(collection, query, page, limit):
    skip = page_args(page, limit)
    records = list(collection.find(query).skip(skip).limit(limit))
    return {"items": json_safe(records), "page": page, "limit": limit, "total": collection.count_documents(query)}


def get_variant_price(product, variant=None):
    extra_price = 0
    if variant:
        match = next((item for item in product.get("variants", []) if item.get("attribute") == variant.get("attribute") and item.get("value") == variant.get("value")), None)
        if not match:
            raise HTTPException(400, "Variant is not available for this product")
        extra_price = match.get("extraPrice", 0)
    return product["salesPrice"] + extra_price


def subscription_filter(user, filters=None):
    query = dict(filters or {})
    if user["role"] == "customer":
        query["customerId"] = user["id"]
    return query


def list_subscriptions(user, status=None, page=1, limit=20):
    filters = {"status": status} if status else {}
    return paged(subscriptions_collection, subscription_filter(user, filters), page, limit)


def get_subscription(user, identifier):
    query = subscription_filter(user)
    query["$or"] = [{"subscriptionNumber": str(identifier)}]
    if ObjectId.is_valid(str(identifier)):
        query["$or"].append({"_id": ObjectId(str(identifier))})
    record = subscriptions_collection.find_one(query)
    if not record:
        raise HTTPException(404, "Subscription not found")
    return json_safe(record)


def create_subscription(data, user):
    start = parse_date(data.get("startDate"), "startDate")
    plan_id = data.get("planId")
    plan = plans_collection.find_one({"_id": object_id(plan_id), "active": {"$ne": False}})
    if not plan:
        raise HTTPException(404, "Plan not found")
    now = datetime.now(timezone.utc)
    available_from = plan.get("availableFrom")
    available_to = plan.get("availableTo")
    if (available_from and start < as_utc(available_from)) or (available_to and start > as_utc(available_to)):
        raise HTTPException(400, "Plan is not available on the subscription start date")
    lines = data.get("lines", [])
    if not isinstance(lines, list) or not lines:
        raise HTTPException(400, "At least one subscription line is required")
    if sum(line.get("quantity", 0) for line in lines if isinstance(line, dict) and isinstance(line.get("quantity"), (int, float)) and not isinstance(line.get("quantity"), bool)) < plan.get("minQuantity", 1):
        raise HTTPException(400, "Subscription quantity is below the plan minimum")
    normalized = []
    for line in lines:
        quantity = line.get("quantity")
        if isinstance(quantity, bool) or not isinstance(quantity, (int, float)) or quantity <= 0:
            raise HTTPException(400, "Line quantity must be a positive number")
        product = products_collection.find_one({"_id": object_id(line.get("productId")), "active": {"$ne": False}})
        if not product:
            raise HTTPException(404, "Product not found")
        unit_price = get_variant_price(product, line.get("variant"))
        normalized.append({
            "productId": str(product["_id"]), "variant": line.get("variant"),
            "quantity": quantity, "unitPrice": unit_price,
            "tax": line.get("tax", 0), "amount": quantity * unit_price,
        })
    customer_id = data.get("customerId") or user["id"]
    if user["role"] == "customer" and customer_id != user["id"]:
        raise HTTPException(403, "Customers can only create subscriptions for themselves")
    customer = users_collection.find_one({"_id": object_id(customer_id), "role": "customer"})
    if not customer:
        raise HTTPException(400, "customerId must refer to a customer account")
    number = f"SUB-{subscriptions_collection.count_documents({}) + 1:04d}"
    document = {
        "subscriptionNumber": number, "customerId": str(customer["_id"]),
        "planId": str(plan["_id"]), "startDate": start,
        "expiryDate": parse_date(data["expiryDate"], "expiryDate") if data.get("expiryDate") else None,
        "paymentTerms": data.get("paymentTerms", ""), "nextInvoiceDate": None,
        "status": "Draft", "lines": normalized,
        "createdAt": now, "updatedAt": now,
    }
    if document["expiryDate"] and document["expiryDate"] <= start:
        raise HTTPException(400, "expiryDate must be after startDate")
    inserted = subscriptions_collection.insert_one(document)
    document["_id"] = inserted.inserted_id
    return json_safe(document)


def update_subscription_status(user, identifier, status):
    subscription = get_subscription(user, identifier)
    current = subscription["status"]
    if status not in TRANSITIONS.get(current, ()):
        raise HTTPException(400, f"Invalid status transition: {current} to {status}")
    update = {"status": status, "updatedAt": datetime.now(timezone.utc)}
    if status == "Active":
        update["nextInvoiceDate"] = parse_date(subscription["startDate"], "startDate")
    subscriptions_collection.update_one({"_id": ObjectId(subscription["id"])}, {"$set": update})
    subscription.update({key: json_safe(value) for key, value in update.items()})
    return subscription


def parse_date(value, field):
    if not value:
        raise HTTPException(400, f"{field} is required")
    if isinstance(value, datetime):
        return as_utc(value)
    try:
        return as_utc(datetime.fromisoformat(value.replace("Z", "+00:00")))
    except (ValueError, AttributeError):
        raise HTTPException(400, f"{field} must be an ISO date or datetime")


def as_utc(value):
    return value.replace(tzinfo=timezone.utc) if value.tzinfo is None else value.astimezone(timezone.utc)
