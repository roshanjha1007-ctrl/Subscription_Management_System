from fastapi import HTTPException

from backend.services import get_subscription, list_subscriptions


def _user(payload):
    context = payload.get("user_context")
    if not isinstance(context, dict) or not context.get("id") or context.get("role") not in {"admin", "staff", "customer"}:
        raise ValueError("An authorised user_context with id and role is required")
    return {"id": str(context["id"]), "role": context["role"]}


def list_subscriptions_tool(payload):
    result = list_subscriptions(
        _user(payload), status=payload.get("status"),
        page=payload.get("page", 1), limit=payload.get("limit", 20),
    )
    return {"items": result["items"], "total": result["total"]}


def get_subscription_tool(payload):
    try:
        return {"found": True, "subscription": get_subscription(_user(payload), payload.get("id") or payload.get("number"))}
    except HTTPException as error:
        if error.status_code == 404:
            return {"found": False, "message": "Subscription not found"}
        raise
