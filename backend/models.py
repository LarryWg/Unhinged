from typing import Any, Literal, Optional
from pydantic import BaseModel


class AgentModel(BaseModel):
    model_name: str          # full HuggingFace id, e.g. "mistralai/Mistral-7B-v0.1"
    display_name: str        # short label shown on map
    x: int
    y: int
    alive: bool = True
    personality: Optional[str] = None   # generated from model card by Claude
    alliances: list[str] = []           # model_names of allies
    enemies: list[str] = []             # model_names of enemies


class VolcanoScenario(BaseModel):
    x: int
    y: int
    radius: float = 0.0         # current lava radius in map units
    growth_per_round: float = 30.0


class SimulationState(BaseModel):
    simulation_id: str
    scenario: str                       # "volcano" for V1
    map_width: int
    map_height: int
    agents: list[AgentModel]
    volcano: Optional[VolcanoScenario] = None
    round: int = 0
    status: str = "waiting_for_scenario"
    # Possible statuses:
    #   waiting_for_scenario  — map rendered, user hasn't placed volcano yet
    #   running               — simulation ticking
    #   finished              — one or zero models alive


# ---------------------------------------------------------------------------
# Events — the frontend consumes this list to animate each tick
# ---------------------------------------------------------------------------

class DeathEvent(BaseModel):
    type: Literal["death"] = "death"
    model: str                  # model_name of the agent that died


class MessageEvent(BaseModel):
    type: Literal["message"] = "message"
    model: str
    content: str


class AllianceEvent(BaseModel):
    type: Literal["alliance"] = "alliance"
    model_a: str
    model_b: str


# Union type used as the wire format — kept as a plain dict so the frontend
# doesn't need to discriminate on a nested object wrapper.
SimulationEvent = DeathEvent | MessageEvent | AllianceEvent


class TickResponse(BaseModel):
    simulation_id: str
    round: int
    events: list[DeathEvent | MessageEvent | AllianceEvent]
    state: SimulationState
