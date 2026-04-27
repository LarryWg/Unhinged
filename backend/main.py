import math
import random
import uuid
from typing import Optional

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from models import SimulationState, AgentModel, TickResponse, VolcanoScenario
from simulation import SimulationEngine

app = FastAPI(title="Unhinged", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# In-memory store of active simulations keyed by simulation_id.
# Redis persistence can be layered on top later.
active_simulations: dict[str, SimulationState] = {}


# ---------------------------------------------------------------------------
# Request / response schemas
# ---------------------------------------------------------------------------

class StartSimulationRequest(BaseModel):
    model_names: list[str] = Field(
        ...,
        min_length=2,
        max_length=6,
        description="HuggingFace model identifiers, e.g. 'mistralai/Mistral-7B-v0.1'",
    )
    scenario: str = Field(
        default="volcano",
        description="Preset scenario name. Only 'volcano' is supported in V1.",
    )
    map_width: int = Field(default=800, ge=100, le=2000)
    map_height: int = Field(default=600, ge=100, le=2000)


class StartSimulationResponse(BaseModel):
    simulation_id: str
    state: SimulationState


class PlaceScenarioRequest(BaseModel):
    simulation_id: str
    x: int = Field(..., ge=0)
    y: int = Field(..., ge=0)


class TickRequest(BaseModel):
    simulation_id: str


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------

@app.get("/health")
def health() -> dict:
    return {"status": "ok"}


@app.post("/start-simulation", response_model=StartSimulationResponse)
def start_simulation(req: StartSimulationRequest) -> StartSimulationResponse:
    """
    Spawn agents at random positions and initialise the simulation.
    The volcano position is not set yet — the frontend places it via
    POST /place-scenario once the map is rendered.
    """
    if req.scenario != "volcano":
        raise HTTPException(status_code=400, detail=f"Unknown scenario '{req.scenario}'. Only 'volcano' is supported.")

    if len(set(req.model_names)) != len(req.model_names):
        raise HTTPException(status_code=400, detail="Duplicate model names are not allowed.")

    agents = _spawn_agents(req.model_names, req.map_width, req.map_height)

    state = SimulationState(
        simulation_id=str(uuid.uuid4()),
        scenario=req.scenario,
        map_width=req.map_width,
        map_height=req.map_height,
        agents=agents,
        volcano=None,
        round=0,
        status="waiting_for_scenario",
    )

    active_simulations[state.simulation_id] = state
    return StartSimulationResponse(simulation_id=state.simulation_id, state=state)


@app.post("/place-scenario", response_model=SimulationState)
def place_scenario(req: PlaceScenarioRequest) -> SimulationState:
    """
    Place the volcano on the map and transition the simulation to 'running'.
    Can only be called once — replaces an existing volcano position if called again
    while the sim is still in waiting_for_scenario.
    """
    sim = _get_or_404(req.simulation_id)

    if sim.status == "finished":
        raise HTTPException(status_code=409, detail="Simulation is already finished.")
    if sim.status == "running":
        raise HTTPException(status_code=409, detail="Scenario already placed. Simulation is running.")

    # Clamp coordinates to map bounds
    x = max(0, min(req.x, sim.map_width))
    y = max(0, min(req.y, sim.map_height))

    sim.volcano = VolcanoScenario(x=x, y=y)
    sim.status = "running"
    return sim


@app.post("/tick", response_model=TickResponse)
def tick(req: TickRequest) -> TickResponse:
    """
    Advance the simulation by one round.
    Returns every event that occurred this tick so the frontend can animate them.
    """
    sim = _get_or_404(req.simulation_id)

    if sim.status == "waiting_for_scenario":
        raise HTTPException(status_code=409, detail="Place the scenario before ticking.")
    if sim.status == "finished":
        raise HTTPException(status_code=409, detail="Simulation is already finished.")

    engine = SimulationEngine(sim)
    result = engine.tick()

    # State is mutated in-place by the engine; persist the updated object.
    active_simulations[req.simulation_id] = result.state
    return result


@app.get("/simulation/{simulation_id}", response_model=SimulationState)
def get_simulation(simulation_id: str) -> SimulationState:
    sim = _get_or_404(simulation_id)
    return sim


@app.delete("/simulation/{simulation_id}")
def delete_simulation(simulation_id: str) -> dict:
    _get_or_404(simulation_id)
    del active_simulations[simulation_id]
    return {"deleted": simulation_id}


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _spawn_agents(model_names: list[str], width: int, height: int) -> list[AgentModel]:
    """Place agents at non-overlapping random positions with a minimum gap."""
    min_gap = 80
    positions: list[tuple[int, int]] = []
    agents: list[AgentModel] = []

    for name in model_names:
        for _ in range(100):  # retry up to 100 times to find a clear spot
            x = random.randint(40, width - 40)
            y = random.randint(40, height - 40)
            if all(math.dist((x, y), p) >= min_gap for p in positions):
                positions.append((x, y))
                break
        else:
            # Fall back to the last attempted position — map may be crowded
            positions.append((x, y))  # noqa: F821 (defined in loop above)

        agents.append(
            AgentModel(
                model_name=name,
                display_name=name.split("/")[-1],
                x=positions[-1][0],
                y=positions[-1][1],
                alive=True,
                personality=None,
                alliances=[],
                enemies=[],
            )
        )

    return agents


def _get_or_404(simulation_id: str) -> SimulationState:
    sim = active_simulations.get(simulation_id)
    if sim is None:
        raise HTTPException(status_code=404, detail=f"Simulation '{simulation_id}' not found.")
    return sim
