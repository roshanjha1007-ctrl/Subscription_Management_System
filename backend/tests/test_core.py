import os
import unittest
from unittest.mock import patch

os.environ.setdefault("MONGO_URI", "mongodb://127.0.0.1:27017")
os.environ.setdefault("JWT_SECRET", "test-secret-that-is-at-least-32-characters-long")

from fastapi import HTTPException
from fastapi.testclient import TestClient

from backend.main import app
from backend.security import validate_password
from backend.services import TRANSITIONS, get_variant_price, subscription_filter


class CoreChecks(unittest.TestCase):
    def test_weak_password_is_rejected(self):
        with self.assertRaises(HTTPException):
            validate_password("weakpass")

    def test_password_rules_accept_valid_password(self):
        validate_password("StrongPass!9")

    def test_status_lifecycle_only_moves_forward(self):
        self.assertEqual(TRANSITIONS["Draft"], ("Quotation",))
        self.assertEqual(TRANSITIONS["Closed"], ())
        self.assertNotIn("Active", TRANSITIONS["Draft"])

    def test_variant_add_on_is_included(self):
        product = {"salesPrice": 40, "variants": [{"attribute": "tier", "value": "pro", "extraPrice": 7}]}
        self.assertEqual(get_variant_price(product, {"attribute": "tier", "value": "pro"}), 47)

    def test_customer_subscription_filter_is_shared(self):
        self.assertEqual(subscription_filter({"id": "abc", "role": "customer"}, {"status": "Active"}), {"status": "Active", "customerId": "abc"})

    def test_health_route_starts_without_mongo_query(self):
        with patch("backend.main.test_connection"), patch("backend.main.create_indexes"):
            response = TestClient(app).get("/health")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json(), {"status": "healthy"})


if __name__ == "__main__":
    unittest.main()
