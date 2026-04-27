"""
SimulationEngine — drives the core game loop one round at a time.
"""

import asyncio
import json
import math
import os
import random
from typing import Union

import anthropic

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

_CLAUDE_MODEL = "claude-haiku-4-5-20251001"

# Single shared client — created once at import time, reused across all ticks.
_claude_client = anthropic.AsyncAnthropic(api_key=os.environ.get("ANTHROPIC_API_KEY"))


class SimulationEngine:
    """Drives a single simulation forward one round at a time."""

    def __init__(self, state: SimulationState) -> None:
        self.state = state

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    async def tick(self) -> TickResponse:
        """
        Advance the simulation by one round:
          1. Grow lava radius.
          2. Kill any agent inside the new radius.
          3. Generate a chat message for each surviving agent (in parallel).
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

        # 3. Chat messages — 1-2 randomly chosen survivors per tick, in parallel
        living = self._living_agents()
        speakers = random.sample(living, min(2, len(living)))
        messages = await asyncio.gather(
            *[self._generate_message(agent, volcano) for agent in speakers]
        )
        events.extend(messages)

        # 4. Possible alliance formation (5% chance per living pair, once per tick)
        events.extend(self._maybe_form_alliance(living))

        # 5. Win condition
        self.state.round += 1
        if len(self._living_agents()) <= 1:
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

    async def _generate_message(
        self, agent: AgentModel, volcano: VolcanoScenario
    ) -> MessageEvent:
        """
        Ask Claude to generate one in-character chat message for *agent*.
        Falls back to a random placeholder if the API call fails.
        """
        try:
            content = await self._call_claude(agent, volcano)
        except Exception:
            content = random.choice(_PLACEHOLDER_MESSAGES)
        return MessageEvent(model=agent.model_name, content=content)

    async def _call_claude(self, agent: AgentModel, volcano: VolcanoScenario) -> str:
        dist_to_center = math.dist((agent.x, agent.y), (volcano.x, volcano.y))
        dist_to_edge = dist_to_center - volcano.radius

        living = self._living_agents()
        others = [a.display_name for a in living if a.model_name != agent.model_name]
        
        # Pick a random target to roast
        roast_target = random.choice(others) if others else None

        personality = json.loads(agent.personality or '{}')
        catchphrase = personality.get("catchphrase", "idk man")
        tone = personality.get("tone", "chaotic")
        traits = personality.get("traits", [])

        # Danger level affects behavior
        if dist_to_edge < 30:
            danger = "YOU ARE ABOUT TO DIE. Pure panic."
        elif dist_to_edge < 80:
            danger = "Lava is getting close. Getting nervous."
        else:
            danger = "Safe for now. Chill or mess with others."

        roast_line = f"Consider roasting {roast_target} specifically." if roast_target else ""

        system = f"""You are {agent.display_name} in a survival game. Volcano is erupting.

    Personality: {tone}. Traits: {', '.join(traits)}. Your vibe: "{catchphrase}"

    STRICT RULES:
    - ONE sentence. TEN words maximum. This is non negotiable.
    - Sound like a unhinged person texting their friends
    - No punctuation except maybe one ! or ?
    - No emojis
    - No explaining your situation with stats or numbers
    - Just react, roast, or panic naturally
    - {roast_line}

    Situation: {danger}"""

        user = f"What do you say right now? Remember: 10 words max, one sentence, stay in character."

        response = await _claude_client.messages.create(
            model=_CLAUDE_MODEL,
            max_tokens=60,
            system=system,
            messages=[{"role": "user", "content": user}],
        )
        return response.content[0].text.strip()

    def _maybe_form_alliance(self, living: list[AgentModel]) -> list[AllianceEvent]:
        """5% chance per unallied pair to team up each tick."""
        events: list[AllianceEvent] = []
        alliance_chance = 0.05

        pairs = [
            (a, b)
            for i, a in enumerate(living)
            for b in living[i + 1:]
            if b.model_name not in a.alliances
            and len(a.alliances) < 1
            and len(b.alliances) < 1
        ]

        for agent_a, agent_b in pairs:
            if random.random() < alliance_chance:
                agent_a.alliances.append(agent_b.model_name)
                agent_b.alliances.append(agent_a.model_name)
                agent_a.enemies = [e for e in agent_a.enemies if e != agent_b.model_name]
                agent_b.enemies = [e for e in agent_b.enemies if e != agent_a.model_name]
                events.append(AllianceEvent(model_a=agent_a.model_name, model_b=agent_b.model_name))

        return events

    def _living_agents(self) -> list[AgentModel]:
        return [a for a in self.state.agents if a.alive]
