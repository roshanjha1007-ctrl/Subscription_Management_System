import unittest

from backend.ai.orchestrator import AIOrchestrator


class TestAIOrchestrator(unittest.TestCase):
    def setUp(self):
        self.logs = []

        def fake_logger(intent, payload, response, status, error=None):
            self.logs.append({
                "intent": intent,
                "status": status,
                "error": error,
            })

        self.orchestrator = AIOrchestrator(logger=fake_logger)

    def test_successful_agent_execution(self):
        self.orchestrator.register_agent(
            "greeting",
            lambda payload: {"message": f"Hello {payload['name']}"},
        )

        result = self.orchestrator.route_request(
            "greeting",
            {"name": "Roshan"},
        )

        self.assertTrue(result["success"])
        self.assertEqual(result["data"]["message"], "Hello Roshan")
        self.assertEqual(self.logs[-1]["status"], "success")

    def test_unknown_intent(self):
        result = self.orchestrator.route_request(
            "unknown",
            {},
        )

        self.assertFalse(result["success"])
        self.assertEqual(self.logs[-1]["status"], "not_found")

    def test_agent_error(self):
        def failing_agent(payload):
            raise RuntimeError("Test failure")

        self.orchestrator.register_agent("failure", failing_agent)

        result = self.orchestrator.route_request("failure", {})

        self.assertFalse(result["success"])
        self.assertEqual(self.logs[-1]["status"], "error")

    def test_invalid_payload(self):
        with self.assertRaises(ValueError):
            self.orchestrator.route_request("greeting", "invalid")


if __name__ == "__main__":
    unittest.main()
