"""End-to-end local MongoDB check: python -m backend.tests.live_smoke"""

import os
import socket
import subprocess
import sys
import time
from datetime import datetime, timezone

import httpx

os.environ.setdefault("MONGO_URI", "mongodb://127.0.0.1:27017")
os.environ.setdefault("DB_NAME", "subscription_management")
os.environ.setdefault("JWT_SECRET", "local-smoke-secret-please-replace-before-deploy-12345")
os.environ.setdefault("SEED_DEMO_PASSWORD", "DemoPass!2026")
os.environ.setdefault("ADMIN_EMAIL", "admin@example.com")


def run_smoke():
    from backend.ai.router import dispatch_ai_request
    from backend.seed import seed_demo_data

    seed_demo_data()
    with socket.socket() as sock:
        sock.bind(("127.0.0.1", 0))
        port = sock.getsockname()[1]
    server = subprocess.Popen(
        [sys.executable, "-m", "uvicorn", "backend.main:app", "--host", "127.0.0.1", "--port", str(port)],
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
        env=os.environ.copy(),
    )
    base = f"http://127.0.0.1:{port}"
    try:
        with httpx.Client(base_url=base, timeout=3) as client:
            for _ in range(40):
                try:
                    health = client.get(f"{base}/health")
                    break
                except httpx.ConnectError:
                    time.sleep(0.25)
            else:
                raise AssertionError("API server did not start")
            assert health.status_code == 200 and health.json()["status"] == "healthy"

            password = os.environ["SEED_DEMO_PASSWORD"]
            admin = client.post("/api/auth/login", json={"email": os.environ["ADMIN_EMAIL"], "password": password}).json()
            customer = client.post("/api/auth/login", json={"email": "customer1@example.com", "password": password}).json()
            other = client.post("/api/auth/login", json={"email": "customer2@example.com", "password": password}).json()
            admin_headers = {"Authorization": f"Bearer {admin['token']}"}
            customer_headers = {"Authorization": f"Bearer {customer['token']}"}
            assert client.get("/api/auth/me", headers=admin_headers).json()["user"]["role"] == "admin"
            assert client.get("/api/products", headers=admin_headers).status_code == 200
            assert client.get("/api/plans", headers=admin_headers).status_code == 200

            plan = client.get("/api/plans", headers=admin_headers).json()["items"][0]
            product = client.get("/api/products", headers=admin_headers).json()["items"][0]
            drafts = client.get("/api/subscriptions?status=Draft", headers=admin_headers).json()["items"]
            other_draft = next((item for item in drafts if item["customerId"] == other["user"]["id"]), None)
            if other_draft is None:
                created = client.post("/api/subscriptions", headers=admin_headers, json={
                    "customerId": other["user"]["id"], "planId": plan["id"],
                    "startDate": datetime.now(timezone.utc).isoformat(),
                    "lines": [{"productId": product["id"], "variant": {"attribute": "tier", "value": "premium"}, "quantity": 1}],
                })
                assert created.status_code == 201, created.text
                other_draft = created.json()

            sub1 = client.get("/api/subscriptions/SUB-0001", headers=admin_headers).json()
            sequence = ("Draft", "Quotation", "Confirmed", "Active")
            for status in sequence[sequence.index(sub1["status"]) + 1:]:
                response = client.patch(f"/api/subscriptions/{sub1['id']}/status", headers=admin_headers, json={"status": status})
                assert response.status_code == 200, response.text
                sub1 = response.json()
            assert sub1["nextInvoiceDate"]
            assert client.get(f"/api/subscriptions/{sub1['id']}", headers={"Authorization": f"Bearer {other['token']}"}).status_code == 404

            active = dispatch_ai_request("list_subscriptions", {"user_context": customer["user"], "status": "Active"})
            detail = dispatch_ai_request("get_subscription", {"user_context": admin["user"], "number": "SUB-0001"})
            draft_list = dispatch_ai_request("list_subscriptions", {"user_context": admin["user"], "status": "Draft"})
            assert active["success"] and any(item["subscriptionNumber"] == "SUB-0001" for item in active["data"]["items"])
            assert detail["success"] and detail["data"]["found"] and detail["data"]["subscription"]["status"] == "Active"
            assert draft_list["success"] and any(item["customerId"] == other["user"]["id"] for item in draft_list["data"]["items"])
            print("Live smoke passed: server, auth, products, plans, lifecycle, role boundaries, and subscription agent tools")
    finally:
        server.terminate()
        try:
            server.wait(timeout=10)
        except subprocess.TimeoutExpired:
            server.kill()
            server.wait(timeout=5)


if __name__ == "__main__":
    run_smoke()
