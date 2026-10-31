from datetime import date
from decimal import Decimal

from app.services.finance_service import (
    calculate_finance_summary,
    get_customer_outstanding,
)

invoices = [
    {
        "status": "Confirmed",
        "balance_due": Decimal("2484.00"),
        "due_date": date(2026, 10, 20),
        "customer": {
            "customer_id": "C101",
            "name": "ABC Company"
        }
    },
    {
        "status": "Confirmed",
        "balance_due": Decimal("1500.00"),
        "due_date": date(2026, 11, 15),
        "customer": {
            "customer_id": "C102",
            "name": "XYZ Company"
        }
    },
    {
        "status": "Paid",
        "balance_due": Decimal("0.00"),
        "due_date": date(2026, 10, 10),
        "customer": {
            "customer_id": "C103",
            "name": "Paid Company"
        }
    }
]

summary = calculate_finance_summary(
    invoices,
    today=date(2026, 10, 31)
)

print("Finance Summary:", summary)
print("Customer Outstanding:", get_customer_outstanding(invoices))