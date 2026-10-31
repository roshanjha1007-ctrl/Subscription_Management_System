import unittest
from unittest.mock import Mock, patch

from ai.agents.finance_agent import (
    fetch_finance_data,
    finance_summary_agent,
    finance_outstanding_agent,
    finance_overdue_agent,
)


class TestFinanceAgent(unittest.TestCase):

    @patch("ai.agents.finance_agent.httpx.get")
    def test_summary_endpoint(self, mock_get):
        mock_response = Mock()
        mock_response.json.return_value = {"total_outstanding": "0.00"}
        mock_get.return_value = mock_response

        result = finance_summary_agent({})

        self.assertEqual(result, {"total_outstanding": "0.00"})
        mock_get.assert_called_once()
        mock_response.raise_for_status.assert_called_once()

    @patch("ai.agents.finance_agent.httpx.get")
    def test_outstanding_endpoint(self, mock_get):
        mock_response = Mock()
        mock_response.json.return_value = []
        mock_get.return_value = mock_response

        self.assertEqual(finance_outstanding_agent({}), [])

    @patch("ai.agents.finance_agent.httpx.get")
    def test_overdue_endpoint(self, mock_get):
        mock_response = Mock()
        mock_response.json.return_value = []
        mock_get.return_value = mock_response

        self.assertEqual(finance_overdue_agent({}), [])

    def test_rejects_unsupported_endpoint(self):
        with self.assertRaises(ValueError):
            fetch_finance_data("delete_everything")


if __name__ == "__main__":
    unittest.main()
