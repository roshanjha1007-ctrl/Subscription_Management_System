import re
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query
from pymongo.errors import DuplicateKeyError

from backend.database.collections import (
    users_collection, products_collection, plans_collection,
)
from backend.security import (
    authenticate, create_token, hash_password, require_role, validate_password,
    verify_password,
)
from backend.services import create_subscription, get_subscription, json_safe, list_subscriptions, object_id, paged, parse_date, update_subscription_status

router = APIRouter()


def email_value(value):
    if not isinstance(value, str) or not re.fullmatch(r"[^\s@]+@[^\s@]+\.[^\s@]+", value):
        raise HTTPException(400, "A valid email is required")
    return value.strip().lower()


def user_response(user):
    return {"id": str(user["_id"]), "name": user["name"], "email": user["email"], "role": user["role"]}


def clean_payload(payload, allowed):
    return {key: value for key, value in payload.items() if key in allowed}


@router.post("/auth/register", status_code=201)
def register(payload: dict):
    name = payload.get("name")
    if not isinstance(name, str) or not name.strip():
        raise HTTPException(400, "name is required")
    email = email_value(payload.get("email"))
    password = payload.get("password")
    validate_password(password)
    user = {"name": name.strip(), "email": email, "passwordHash": hash_password(password), "role": "customer", "createdAt": datetime.now(timezone.utc)}
    try:
        result = users_collection.insert_one(user)
    except DuplicateKeyError:
        raise HTTPException(409, "Email is already registered")
    user["_id"] = result.inserted_id
    return {"user": user_response(user)}


@router.post("/auth/login")
def login(payload: dict):
    user = users_collection.find_one({"email": email_value(payload.get("email"))})
    if not user or not verify_password(payload.get("password", ""), user.get("passwordHash", "")):
        raise HTTPException(401, "Invalid email or password")
    return {"token": create_token(user), "tokenType": "bearer", "user": user_response(user)}


@router.get("/auth/me")
def me(user=Depends(authenticate)):
    record = users_collection.find_one({"_id": object_id(user["id"])})
    if not record:
        raise HTTPException(401, "User no longer exists")
    return {"user": user_response(record)}


@router.post("/auth/staff", status_code=201)
def create_staff(payload: dict, admin=Depends(require_role("admin"))):
    name = payload.get("name")
    if not isinstance(name, str) or not name.strip():
        raise HTTPException(400, "name is required")
    email = email_value(payload.get("email"))
    password = payload.get("password")
    validate_password(password)
    user = {"name": name.strip(), "email": email, "passwordHash": hash_password(password), "role": "staff", "createdAt": datetime.now(timezone.utc)}
    try:
        result = users_collection.insert_one(user)
    except DuplicateKeyError:
        raise HTTPException(409, "Email is already registered")
    user["_id"] = result.inserted_id
    return {"user": user_response(user)}


@router.post("/products", status_code=201)
def create_product(payload: dict, admin=Depends(require_role("admin"))):
    data = clean_payload(payload, {"name", "type", "salesPrice", "costPrice", "notes", "variants"})
    if not isinstance(data.get("name"), str) or not data["name"].strip():
        raise HTTPException(400, "name is required")
    for field in ("salesPrice", "costPrice"):
        value = data.get(field)
        if isinstance(value, bool) or not isinstance(value, (int, float)) or value < 0:
            raise HTTPException(400, f"{field} must be a non-negative number")
    variants = data.get("variants", [])
    if not isinstance(variants, list) or any(not isinstance(v, dict) or not v.get("attribute") or not v.get("value") or isinstance(v.get("extraPrice", 0), bool) or not isinstance(v.get("extraPrice", 0), (int, float)) or v.get("extraPrice", 0) < 0 for v in variants):
        raise HTTPException(400, "variants must contain attribute, value, and non-negative extraPrice")
    data.update({"name": data["name"].strip(), "active": True, "createdAt": datetime.now(timezone.utc)})
    result = products_collection.insert_one(data)
    data["_id"] = result.inserted_id
    return json_safe(data)


@router.get("/products")
def list_products(page: int = 1, limit: int = Query(20, le=100), user=Depends(authenticate)):
    return paged(products_collection, {"active": {"$ne": False}}, page, limit)


@router.get("/products/{product_id}")
def get_product(product_id: str, user=Depends(authenticate)):
    record = products_collection.find_one({"_id": object_id(product_id), "active": {"$ne": False}})
    if not record:
        raise HTTPException(404, "Product not found")
    return json_safe(record)


@router.put("/products/{product_id}")
def update_product(product_id: str, payload: dict, admin=Depends(require_role("admin"))):
    data = clean_payload(payload, {"name", "type", "salesPrice", "costPrice", "notes", "variants", "active"})
    if "name" in data and (not isinstance(data["name"], str) or not data["name"].strip()):
        raise HTTPException(400, "name cannot be empty")
    for field in ("salesPrice", "costPrice"):
        if field in data and (isinstance(data[field], bool) or not isinstance(data[field], (int, float)) or data[field] < 0):
            raise HTTPException(400, f"{field} must be a non-negative number")
    result = products_collection.find_one_and_update({"_id": object_id(product_id)}, {"$set": data}, return_document=True)
    if not result:
        raise HTTPException(404, "Product not found")
    return json_safe(result | data)


@router.post("/plans", status_code=201)
def create_plan(payload: dict, admin=Depends(require_role("admin"))):
    data = clean_payload(payload, {"name", "price", "billingPeriod", "minQuantity", "availableFrom", "availableTo", "autoClose", "closable", "pausable", "renewable"})
    validate_plan(data)
    data.update({"active": True, "createdAt": datetime.now(timezone.utc)})
    result = plans_collection.insert_one(data)
    data["_id"] = result.inserted_id
    return json_safe(data)


@router.get("/plans")
def list_plans(page: int = 1, limit: int = Query(20, le=100), user=Depends(authenticate)):
    return paged(plans_collection, {"active": {"$ne": False}}, page, limit)


@router.get("/plans/{plan_id}")
def get_plan(plan_id: str, user=Depends(authenticate)):
    record = plans_collection.find_one({"_id": object_id(plan_id), "active": {"$ne": False}})
    if not record:
        raise HTTPException(404, "Plan not found")
    return json_safe(record)


@router.put("/plans/{plan_id}")
def update_plan(plan_id: str, payload: dict, admin=Depends(require_role("admin"))):
    data = clean_payload(payload, {"name", "price", "billingPeriod", "minQuantity", "availableFrom", "availableTo", "autoClose", "closable", "pausable", "renewable", "active"})
    existing = plans_collection.find_one({"_id": object_id(plan_id)})
    if not existing:
        raise HTTPException(404, "Plan not found")
    validate_plan(existing | data)
    result = plans_collection.find_one_and_update({"_id": existing["_id"]}, {"$set": data}, return_document=True)
    return json_safe(result | data)


@router.post("/subscriptions", status_code=201)
def create_subscription_route(payload: dict, user=Depends(require_role("admin", "staff"))):
    return create_subscription(payload, user)


@router.get("/subscriptions")
def subscriptions(status: str | None = None, page: int = 1, limit: int = Query(20, le=100), user=Depends(authenticate)):
    if status and status not in ("Draft", "Quotation", "Confirmed", "Active", "Closed"):
        raise HTTPException(400, "Invalid subscription status")
    return list_subscriptions(user, status, page, limit)


@router.get("/subscriptions/{identifier}")
def subscription_detail(identifier: str, user=Depends(authenticate)):
    return get_subscription(user, identifier)


@router.patch("/subscriptions/{identifier}/status")
def subscription_status(identifier: str, payload: dict, user=Depends(require_role("admin", "staff"))):
    return update_subscription_status(user, identifier, payload.get("status"))


def validate_plan(data):
    if not isinstance(data.get("name"), str) or not data["name"].strip():
        raise HTTPException(400, "name is required")
    if data.get("billingPeriod") not in {"daily", "weekly", "monthly", "yearly"}:
        raise HTTPException(400, "billingPeriod must be daily, weekly, monthly, or yearly")
    if isinstance(data.get("price"), bool) or not isinstance(data.get("price"), (int, float)) or data["price"] < 0:
        raise HTTPException(400, "price must be a non-negative number")
    quantity = data.get("minQuantity", 1)
    if isinstance(quantity, bool) or not isinstance(quantity, (int, float)) or quantity <= 0:
        raise HTTPException(400, "minQuantity must be a positive number")
    data.setdefault("minQuantity", 1)
    for flag in ("autoClose", "closable", "pausable", "renewable"):
        if flag in data and not isinstance(data[flag], bool):
            raise HTTPException(400, f"{flag} must be boolean")
        data.setdefault(flag, False)
    for field in ("availableFrom", "availableTo"):
        if data.get(field):
            data[field] = parse_date(data[field], field)
    if data.get("availableFrom") and data.get("availableTo") and data["availableTo"] <= data["availableFrom"]:
        raise HTTPException(400, "availableTo must be after availableFrom")
