from decimal import Decimal
from app.schemas.invoice import InvoiceLineItem
from app.services.invoice_service import calculate_invoice_totals

items = [
    InvoiceLineItem(
        product_id="P101",
        product_name="Premium Plan",
        quantity=2,
        unit_price=Decimal("2000.00")
    )
]

result = calculate_invoice_totals(
    line_items=items,
    discount_type="fixed",
    discount_value=Decimal("200.00"),
    tax_rate=Decimal("18.00")
)

print(result)