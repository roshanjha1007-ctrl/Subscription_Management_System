from typing import Callable

from .logger import log_ai_interaction
from .agents import (
    finance_summary_agent,
    finance_outstanding_agent,
    finance_overdue_agent,
)


class AIOrchestrator:
    def __init__(self, logger: Callable = log_ai_interaction):
        self.agents = {}
        self.logger = logger

    def register_agent(self, intent: str, agent: Callable):
        if not intent or not callable(agent):
            raise ValueError("A valid intent and callable agent are required")

        self.agents[intent] = agent

    def route_request(self, intent: str, payload: dict):
        if not isinstance(payload, dict):
            raise ValueError("Payload must be a dictionary")

        agent = self.agents.get(intent)

        if agent is None:
            response = {
                "success": False,
                "message": f"No agent registered for intent: {intent}",
            }
            self.logger(intent, payload, response, "not_found")
            return response

        try:
            result = agent(payload)

            response = {
                "success": True,
                "intent": intent,
                "data": result,
            }

            self.logger(intent, payload, response, "success")
            return response

        except Exception as error:
            response = {
                "success": False,
                "message": "Agent execution failed",
            }

            self.logger(
                intent,
                payload,
                response,
                "error",
                error=str(error),
            )
            return response


orchestrator = AIOrchestrator()

orchestrator.register_agent("finance_summary", finance_summary_agent)
orchestrator.register_agent("finance_outstanding", finance_outstanding_agent)
orchestrator.register_agent("finance_overdue", finance_overdue_agent)
