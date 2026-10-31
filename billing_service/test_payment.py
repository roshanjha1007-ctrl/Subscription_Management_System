from datetime import date, datetime, timezone
from decimal import Decimal

from app.schemas.payment import PaymentCreate, PaymentMethod
from app.services.payment_service import apply_payment

invoice = {
    "invoice_number": "INV-001",
    "total": Decimal("4484.00"),
    "amount_paid": Decimal("0.00"),
    "balance_due": Decimal("4484.00"),
    "status": "Confirmed",
}

payment = PaymentCreate(
    invoice_number="INV-001",
    amount=Decimal("2000.00"),
    payment_method=PaymentMethod.UPI,
)

updated_invoice = apply_payment(invoice, payment)

print("Amount paid:", updated_invoice["amount_paid"])
print("Balance due:", updated_invoice["balance_due"])
print("Status:", updated_invoice["status"])