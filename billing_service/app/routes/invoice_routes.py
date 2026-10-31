
from fastapi import APIRouter

router = APIRouter(
    prefix="/api/invoices",
    tags=["Invoices"]
)


@router.get("/test")
async def test_invoice_route():
    return {
        "message": "Invoice routes are working!"
    }
