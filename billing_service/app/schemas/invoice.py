from datetime import date, datetime
from decimal import Decimal
from enum import Enum
from pydantic import BaseModel, Field, ConfigDict


class InvoiceStatus(str, Enum):
    DRAFT = "Draft"
    CONFIRMED = "Confirmed"
    PAID = "Paid"


class InvoiceLineItem(BaseModel):
    product_id: str
    product_name: str
    quantity: int = Field(gt=0)
    unit_price: Decimal = Field(ge=0)


class CustomerSnapshot(BaseModel):
    customer_id: str
    name: str
    email: str | None = None
    address: str | None = None


class GenerateInvoiceRequest(BaseModel):
    subscription_id: str
    billing_period_start: date
    billing_period_end: date


class InvoiceResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    invoice_number: str
    subscription_id: str
    customer: CustomerSnapshot
    line_items: list[InvoiceLineItem]

    subtotal: Decimal
    discount_amount: Decimal = Decimal("0.00")
    tax_amount: Decimal = Decimal("0.00")
    total: Decimal

    amount_paid: Decimal = Decimal("0.00")
    balance_due: Decimal

    currency: str = "INR"
    status: InvoiceStatus
    due_date: date

    created_at: datetime
    updated_at: datetime