import os
import unittest
from unittest.mock import patch

os.environ.setdefault("MONGO_URI", "mongodb://127.0.0.1:27017")
os.environ.setdefault("JWT_SECRET", "test-secret-that-is-at-least-32-characters-long")

from fastapi import HTTPException
from fastapi.testclient import TestClient
from bson import ObjectId

from backend.main import app
from backend.security import create_token, validate_password
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

    def test_customer_cannot_create_staff(self):
        token = create_token({"_id": ObjectId(), "role": "customer"})
        with patch("backend.main.test_connection"), patch("backend.main.create_indexes"):
            response = TestClient(app).post(
                "/api/auth/staff", json={"name": "X", "email": "x@example.com", "password": "StrongPass!9"},
                headers={"Authorization": f"Bearer {token}"},
            )
        self.assertEqual(response.status_code, 403)

    def test_customer_subscription_list_uses_own_id_filter(self):
        user_id = str(ObjectId())
        token = create_token({"_id": user_id, "role": "customer"})
        with patch("backend.main.test_connection"), patch("backend.main.create_indexes"), patch("backend.services.subscriptions_collection") as collection:
            collection.find.return_value.skip.return_value.limit.return_value = []
            collection.count_documents.return_value = 0
            response = TestClient(app).get("/api/subscriptions", headers={"Authorization": f"Bearer {token}"})
        self.assertEqual(response.status_code, 200)
        self.assertEqual(collection.find.call_args.args[0], {"customerId": user_id})

    def test_bad_status_jump_is_rejected(self):
        token = create_token({"_id": ObjectId(), "role": "admin"})
        with patch("backend.main.test_connection"), patch("backend.main.create_indexes"), patch("backend.services.get_subscription", return_value={"id": str(ObjectId()), "status": "Draft"}):
            response = TestClient(app).patch(
                "/api/subscriptions/SUB-0001/status", json={"status": "Active"},
                headers={"Authorization": f"Bearer {token}"},
            )
        self.assertEqual(response.status_code, 400)

    def test_status_activation_sets_first_invoice_date(self):
        token = create_token({"_id": ObjectId(), "role": "staff"})
        subscription_id = str(ObjectId())
        with patch("backend.main.test_connection"), patch("backend.main.create_indexes"), \
             patch("backend.services.get_subscription", return_value={"id": subscription_id, "status": "Confirmed", "startDate": "2026-10-31T00:00:00+00:00"}), \
             patch("backend.services.subscriptions_collection") as collection:
            response = TestClient(app).patch(
                "/api/subscriptions/SUB-0001/status", json={"status": "Active"},
                headers={"Authorization": f"Bearer {token}"},
            )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["nextInvoiceDate"], "2026-10-31T00:00:00+00:00")
        self.assertEqual(collection.update_one.call_args.args[1]["$set"]["status"], "Active")


if __name__ == "__main__":
    unittest.main()
