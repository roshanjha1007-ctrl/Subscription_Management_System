from datetime import date, datetime, timezone
from decimal import Decimal


def as_decimal(value) -> Decimal:
    """Convert Decimal128 or numeric values into Decimal."""
    if hasattr(value, "to_decimal"):
        return value.to_decimal()
    return Decimal(str(value))


def get_date(value) -> date:
    """Handle both MongoDB datetime and Python date values."""
    if isinstance(value, datetime):
        return value.date()
    return value


def calculate_finance_summary(
    invoices: list[dict],
    today: date | None = None
) -> dict:
    """Calculate overall outstanding and overdue finance summary."""

    today = today or datetime.now(timezone.utc).date()

    total_outstanding = Decimal("0.00")
    total_overdue = Decimal("0.00")
    unpaid_count = 0
    overdue_count = 0

    for invoice in invoices:
        if invoice.get("status") == "Draft":
            continue

        balance = as_decimal(invoice.get("balance_due", "0.00"))

        if balance <= 0:
            continue

        total_outstanding += balance
        unpaid_count += 1

        due_date = get_date(invoice["due_date"])

        if due_date < today:
            total_overdue += balance
            overdue_count += 1

    return {
        "total_outstanding": total_outstanding,
        "total_overdue": total_overdue,
        "unpaid_invoice_count": unpaid_count,
        "overdue_invoice_count": overdue_count,
    }


def get_customer_outstanding(invoices: list[dict]) -> list[dict]:
    """Calculate outstanding balance for each customer."""

    customers = {}

    for invoice in invoices:
        if invoice.get("status") == "Draft":
            continue

        balance = as_decimal(invoice.get("balance_due", "0.00"))

        if balance <= 0:
            continue

        customer = invoice.get("customer", {})
        customer_id = customer.get("customer_id", "UNKNOWN")

        if customer_id not in customers:
            customers[customer_id] = {
                "customer_id": customer_id,
                "customer_name": customer.get("name", "Unknown"),
                "outstanding_amount": Decimal("0.00"),
            }

        customers[customer_id]["outstanding_amount"] += balance

    return list(customers.values())