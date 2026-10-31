from datetime import datetime, timezone
from decimal import Decimal, ROUND_HALF_UP

from app.schemas.payment import PaymentCreate


def as_decimal(value) -> Decimal:
    """Convert MongoDB Decimal128 or other numeric values to Decimal."""
    if hasattr(value, "to_decimal"):
        return value.to_decimal()
    return Decimal(str(value))


def apply_payment(invoice: dict, payment: PaymentCreate) -> dict:
    """Apply a payment and return the updated invoice data."""

    if invoice["status"] == "Draft":
        raise ValueError("Cannot pay a draft invoice.")

    total = as_decimal(invoice["total"])
    amount_paid = as_decimal(invoice.get("amount_paid", "0.00"))
    balance_due = total - amount_paid

    payment_amount = payment.amount.quantize(
        Decimal("0.01"), rounding=ROUND_HALF_UP
    )

    if payment_amount <= 0:
        raise ValueError("Payment amount must be greater than zero.")

    if payment_amount > balance_due:
        raise ValueError(
            f"Payment exceeds outstanding balance of {balance_due}."
        )

    new_amount_paid = amount_paid + payment_amount
    new_balance_due = total - new_amount_paid

    invoice["amount_paid"] = new_amount_paid
    invoice["balance_due"] = new_balance_due
    invoice["status"] = "Paid" if new_balance_due == 0 else "Confirmed"
    invoice["updated_at"] = datetime.now(timezone.utc)

    return invoice