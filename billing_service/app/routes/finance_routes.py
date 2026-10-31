from datetime import datetime, timezone
from decimal import Decimal

from fastapi import APIRouter, HTTPException
from fastapi.encoders import jsonable_encoder

from app.database import get_database
from app.services.finance_service import (
    calculate_finance_summary,
    get_customer_outstanding,
)

router = APIRouter(prefix="/api/finance", tags=["Finance"])


def serialize_finance(data):
    return jsonable_encoder(
        data,
        custom_encoder={Decimal: lambda value: str(value)}
    )


async def fetch_invoices():
    db = get_database()
    return await db["invoices"].find({}).to_list(length=10000)


@router.get("/summary")
async def finance_summary():
    try:
        invoices = await fetch_invoices()
        result = calculate_finance_summary(invoices)
        return serialize_finance(result)
    except Exception as error:
        raise HTTPException(status_code=500, detail=str(error))


@router.get("/outstanding")
async def outstanding_summary():
    try:
        invoices = await fetch_invoices()
        result = get_customer_outstanding(invoices)
        return serialize_finance(result)
    except Exception as error:
        raise HTTPException(status_code=500, detail=str(error))


@router.get("/overdue")
async def overdue_invoices():
    try:
        invoices = await fetch_invoices()
        today = datetime.now(timezone.utc).date()

        result = []

        for invoice in invoices:
            if invoice.get("status") == "Draft":
                continue

            balance = invoice.get("balance_due", Decimal("0.00"))

            if hasattr(balance, "to_decimal"):
                balance = balance.to_decimal()
            else:
                balance = Decimal(str(balance))

            due_date = invoice["due_date"]

            if isinstance(due_date, datetime):
                due_date = due_date.date()

            if balance > 0 and due_date < today:
                result.append({
                    "invoice_number": invoice["invoice_number"],
                    "customer": invoice.get("customer", {}),
                    "balance_due": balance,
                    "due_date": due_date,
                    "status": invoice["status"],
                })

        return serialize_finance(result)

    except Exception as error:
        raise HTTPException(status_code=500, detail=str(error))