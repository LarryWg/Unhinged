"""
Personality generation for Unhinged agents.

Fetches a HuggingFace model card and asks Claude to turn it into a
game-character personality profile. All I/O is async.
"""

import json
import os

import anthropic
import httpx

_DEFAULT_PERSONALITY: dict = {
    "tone": "unhinged",
    "traits": ["unpredictable", "chaotic", "feral"],
    "catchphrase": "idk what's happening but we're eating 💀",
    "survival_style": "runs toward danger for no reason",
    "rivalry_style": "allies with everyone then betrays them immediately",
}

_SYSTEM_PROMPT = """\
You are a character designer for a survival game called Unhinged \
where AI models fight to survive disasters.

Given a HuggingFace model card, generate a short personality profile \
for this model as a game character. Be creative and base it on the \
model's actual training data, purpose, and benchmarks.

Return JSON only with these fields:
- tone: one of ["chaotic", "nerdy", "aggressive", "chill", "dramatic", "unhinged"]
- traits: list of 3 short personality traits
- catchphrase: one short GenZ sentence this model would say (can include mild language)
- survival_style: how they approach danger (one sentence)
- rivalry_style: how they talk trash or form alliances (one sentence)\
"""


async def _fetch_model_card(model_name: str) -> str:
    url = f"https://huggingface.co/{model_name}/raw/main/README.md"
    try:
        async with httpx.AsyncClient(timeout=10.0) as http:
            response = await http.get(url)
            if response.status_code == 200:
                # Cap at 4 000 chars so we don't blow the context window.
                return response.text[:4000]
    except Exception:
        pass
    return "A mysterious AI model with unknown origins."


async def generate_personality(model_name: str) -> dict:
    """
    Fetch the model card for *model_name* and ask Claude to produce a
    personality profile. Returns a dict with keys:
      tone, traits, catchphrase, survival_style, rivalry_style.
    Falls back to _DEFAULT_PERSONALITY on any error.
    """
    model_card = await _fetch_model_card(model_name)

    user_message = (
        f"Model name: {model_name}\n\n"
        f"Model card:\n{model_card}"
    )

    client = anthropic.AsyncAnthropic(api_key=os.environ.get("ANTHROPIC_API_KEY"))

    try:
        message = await client.messages.create(
            model="claude-sonnet-4-5",
            max_tokens=512,
            system=_SYSTEM_PROMPT,
            messages=[{"role": "user", "content": user_message}],
        )

        raw = message.content[0].text.strip()

        # Strip markdown fences if Claude wrapped the JSON.
        if raw.startswith("```"):
            raw = raw.split("```")[1]
            if raw.startswith("json"):
                raw = raw[4:]

        personality = json.loads(raw)

        # Validate required keys are present.
        required = {"tone", "traits", "catchphrase", "survival_style", "rivalry_style"}
        if not required.issubset(personality.keys()):
            raise ValueError(f"Missing keys: {required - personality.keys()}")

        return personality

    except Exception:
        return dict(_DEFAULT_PERSONALITY)
