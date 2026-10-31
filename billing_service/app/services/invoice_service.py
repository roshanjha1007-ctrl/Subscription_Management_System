from decimal import Decimal, ROUND_HALF_UP
from typing import Literal

from app.schemas.invoice import InvoiceLineItem


MONEY_PLACES = Decimal("0.01")


def money(value: Decimal) -> Decimal:
    """Round an amount to two decimal places."""
    return value.quantize(MONEY_PLACES, rounding=ROUND_HALF_UP)


def calculate_invoice_totals(
    line_items: list[InvoiceLineItem],
    discount_type: Literal["fixed", "percentage"] = "fixed",
    discount_value: Decimal = Decimal("0.00"),
    tax_rate: Decimal = Decimal("0.00"),
) -> dict:
    """Calculate subtotal, discount, tax and final invoice total."""

    if not line_items:
        raise ValueError("Invoice must contain at least one line item.")

    if discount_value < 0:
        raise ValueError("Discount cannot be negative.")

    if tax_rate < 0 or tax_rate > 100:
        raise ValueError("Tax rate must be between 0 and 100.")

    # 1. Calculate subtotal.
    subtotal = sum(
        (item.unit_price * item.quantity for item in line_items),
        Decimal("0.00")
    )
    subtotal = money(subtotal)

    # 2. Calculate discount.
    if discount_type == "percentage":
        if discount_value > 100:
            raise ValueError("Percentage discount cannot exceed 100.")

        discount_amount = subtotal * discount_value / Decimal("100")

    elif discount_type == "fixed":
        discount_amount = min(discount_value, subtotal)

    else:
        raise ValueError("Discount type must be fixed or percentage.")

    discount_amount = money(discount_amount)

    # 3. Calculate taxable amount and tax.
    taxable_amount = money(subtotal - discount_amount)

    tax_amount = money(
        taxable_amount * tax_rate / Decimal("100")
    )

    # 4. Calculate final total.
    total = money(taxable_amount + tax_amount)

    return {
        "subtotal": subtotal,
        "discount_amount": discount_amount,
        "taxable_amount": taxable_amount,
        "tax_rate": tax_rate,
        "tax_amount": tax_amount,
        "total": total,
    }