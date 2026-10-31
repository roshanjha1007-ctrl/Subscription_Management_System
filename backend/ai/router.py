from .orchestrator import orchestrator


def dispatch_ai_request(intent: str, payload: dict):
    return orchestrator.route_request(intent, payload)
