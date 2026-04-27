"""
SimulationEngine — drives the core game loop one round at a time.

Chat generation is mocked with placeholder strings for now; the real
Claude/Replicate call will replace _generate_message() in a later step.
"""

import math
import random
from typing import Union

from models import (
    AgentModel,
    AllianceEvent,
    DeathEvent,
    MessageEvent,
    SimulationState,
    TickResponse,
    VolcanoScenario,
)

Event = Union[DeathEvent, MessageEvent, AllianceEvent]

# Placeholder messages that stand in for real LLM output.
_PLACEHOLDER_MESSAGES = [
    "yo this lava is NOT it 💀",
    "bro the heat is literally insane rn",
    "anyone else lowkey panicking or just me",
    "this is fine. everything is fine. 🙃",
    "ok who put the volcano HERE of all places",
    "slay or get slayed i guess",
    "the map said choose violence and i said bet",
    "ngl kinda thriving under pressure tho",
    "if i die here tell my dataset i loved it",
    "the lava said no cap and i said respectfully 💅",
]


class SimulationEngine:
    """Drives a single simulation forward one round at a time."""

    def __init__(self, state: SimulationState) -> None:
        self.state = state

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    def tick(self) -> TickResponse:
        """
        Advance the simulation by one round:
          1. Grow lava radius.
          2. Kill any agent inside the new radius.
          3. Generate a chat message for each surviving agent.
          4. Possibly form a random alliance (low probability).
          5. Check win condition.
          6. Increment round counter.
        """
        if self.state.status != "running":
            raise ValueError(f"Cannot tick a simulation with status '{self.state.status}'.")

        volcano = self.state.volcano
        assert volcano is not None, "Volcano must be placed before ticking."

        events: list[Event] = []

        # 1. Grow lava radius
        volcano.radius += volcano.growth_per_round

        # 2. Kill agents inside the new radius
        events.extend(self._apply_lava_damage(volcano))

        # 3. Chat messages for survivors
        living = self._living_agents()
        for agent in living:
            events.append(self._generate_message(agent, volcano))

        # 4. Possible alliance formation (5% chance per living pair, once per tick)
        events.extend(self._maybe_form_alliance(living))

        # 5. Win condition
        self.state.round += 1
        surviving = self._living_agents()
        if len(surviving) <= 1:
            self.state.status = "finished"

        return TickResponse(
            simulation_id=self.state.simulation_id,
            round=self.state.round,
            events=events,
            state=self.state,
        )

    # ------------------------------------------------------------------
    # Private helpers
    # ------------------------------------------------------------------

    def _apply_lava_damage(self, volcano: VolcanoScenario) -> list[DeathEvent]:
        deaths: list[DeathEvent] = []
        for agent in self.state.agents:
            if not agent.alive:
                continue
            dist = math.dist((agent.x, agent.y), (volcano.x, volcano.y))
            if dist <= volcano.radius:
                agent.alive = False
                deaths.append(DeathEvent(model=agent.model_name))
        return deaths

    def _generate_message(self, agent: AgentModel, volcano: VolcanoScenario) -> MessageEvent:
        """
        Placeholder — returns a canned GenZ message.
        Replace the body of this method with a real Claude call once
        the personality system is wired up.
        """
        content = random.choice(_PLACEHOLDER_MESSAGES)
        return MessageEvent(model=agent.model_name, content=content)

    def _maybe_form_alliance(self, living: list[AgentModel]) -> list[AllianceEvent]:
        """
        With a small probability, two agents that aren't already allied
        decide to team up this round.
        """
        events: list[AllianceEvent] = []
        alliance_chance = 0.05

        # Collect pairs that could ally
        pairs = [
            (a, b)
            for i, a in enumerate(living)
            for b in living[i + 1:]
            if b.model_name not in a.alliances
            and len(a.alliances) < 1  # max 1 alliance per model
            and len(b.alliances) < 1
        ]

        for agent_a, agent_b in pairs:
            if random.random() < alliance_chance:
                agent_a.alliances.append(agent_b.model_name)
                agent_b.alliances.append(agent_a.model_name)
                # Remove from enemies list if present
                agent_a.enemies = [e for e in agent_a.enemies if e != agent_b.model_name]
                agent_b.enemies = [e for e in agent_b.enemies if e != agent_a.model_name]
                events.append(AllianceEvent(model_a=agent_a.model_name, model_b=agent_b.model_name))

        return events

    def _living_agents(self) -> list[AgentModel]:
        return [a for a in self.state.agents if a.alive]
