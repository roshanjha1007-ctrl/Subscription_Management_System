from datetime import date, datetime, time, timezone
from decimal import Decimal

from bson.decimal128 import Decimal128

from app.schemas.invoice import InvoiceResponse


def to_decimal128(value: Decimal) -> Decimal128:
    """Convert Decimal to MongoDB Decimal128 safely."""
    return Decimal128(str(value))


def date_to_datetime(value: date) -> datetime:
    """Convert a date into a MongoDB-compatible UTC datetime."""
    return datetime.combine(value, time.min, tzinfo=timezone.utc)


def invoice_to_document(
    invoice: InvoiceResponse,
    billing_period_start: date,
    billing_period_end: date,
) -> dict:
    """Prepare an invoice for storage in MongoDB."""

    document = invoice.model_dump(mode="python")

    # Convert financial fields to Decimal128.
    money_fields = [
        "subtotal",
        "discount_amount",
        "tax_amount",
        "total",
        "amount_paid",
        "balance_due",
    ]

    for field in money_fields:
        document[field] = to_decimal128(document[field])

    # Convert product prices inside invoice line items.
    for item in document["line_items"]:
        item["unit_price"] = to_decimal128(item["unit_price"])

    # MongoDB BSON stores dates as datetime values.
    document["due_date"] = date_to_datetime(document["due_date"])
    document["billing_period_start"] = date_to_datetime(billing_period_start)
    document["billing_period_end"] = date_to_datetime(billing_period_end)

    # Store the status as a plain string.
    document["status"] = invoice.status.value

    return document