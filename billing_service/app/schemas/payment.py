from datetime import datetime, timezone
from decimal import Decimal
from enum import Enum

from pydantic import BaseModel, Field


class PaymentMethod(str, Enum):
    UPI = "UPI"
    CARD = "Card"
    BANK_TRANSFER = "Bank Transfer"
    CASH = "Cash"


class PaymentCreate(BaseModel):
    invoice_number: str
    amount: Decimal = Field(gt=0)
    payment_method: PaymentMethod
    payment_date: datetime = Field(
        default_factory=lambda: datetime.now(timezone.utc)
    )
    note: str | None = None


class PaymentResponse(BaseModel):
    payment_id: str
    invoice_number: str
    amount: Decimal
    payment_method: PaymentMethod
    payment_date: datetime
    note: str | None = None