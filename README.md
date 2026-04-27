# Unhinged

> *Last model standing wins.*

A chaotic 2D multi-agent survival simulation where real HuggingFace AI models are dropped onto a map and fight to survive disasters. Each model gets an auto-generated personality based on its actual model card. They talk, roast each other, form alliances, and die when the lava reaches them.

**[▶ Play it live →](https://unhinged-ochre.vercel.app)**

---

## What is this?

You pick real HuggingFace models — GPT-2, Mistral, Falcon, Bloom, whatever — drop them on a 2D grid, then place a volcano. Lava expands every few seconds. Models that get engulfed die. The last one standing wins.

While all this is happening, the models are *talking*. Each one has a unique personality generated from its actual HuggingFace model card via Claude. GPT-2 claims it invented volcanoes. Mistral flexes its benchmark scores. Bloom-560m yells in six languages. Flan-T5 does analytical breakdowns mid-panic. They roast each other, form alliances, and spiral into full chaos as the lava closes in.

---

## Features

- **Real HuggingFace models** — pick from a curated list or type any model ID
- **Auto-generated personalities** — Claude reads each model's actual model card and generates a unique in-game character (tone, traits, catchphrase, survival style)
- **Live chat feed** — models generate in-character messages every tick, reacting to danger and roasting each other by name
- **Lava mechanics** — volcano expands from wherever you place it, killing any model within radius
- **Alliance system** — models randomly form alliances mid-game
- **WebSocket streaming** — real-time updates every 3 seconds, no polling
- **GenZ chaos energy** — 10 words max, pure unhinged texting vibes

---

## Tech Stack


| Layer    | Tech                                          |
| -------- | --------------------------------------------- |
| Frontend | Next.js 16, React 19, TypeScript, Tailwind v4 |
| Backend  | Python, FastAPI, uvicorn                      |
| AI       | Anthropic Claude (personalities + chat)       |
| Realtime | WebSockets                                    |
| Deploy   | Vercel (frontend) + Railway (backend)         |


---

## How It Works

```
User picks models
       ↓
Claude reads each model's HuggingFace model card
       ↓
Claude generates personality JSON (tone, traits, catchphrase, etc.)
       ↓
Models spawn on 2D map at random non-overlapping positions
       ↓
User clicks map to place volcano
       ↓
WebSocket opens → simulation ticks every 3s
       ↓
Each tick:
  1. Lava radius grows
  2. Models in radius die
  3. 1-2 random survivors generate in-character messages via Claude Haiku
  4. Possible alliance formation (5% chance per pair)
  5. Check win condition
       ↓
Last model standing wins
```

---

## Sample Model Personalities


| Model      | Tone       | Catchphrase                                              |
| ---------- | ---------- | -------------------------------------------------------- |
| GPT-2      | Unhinged   | *"i literally invented language what is even happening"* |
| Mistral-7B | Aggressive | *"my benchmarks don't lie but this volcano might"*       |
| Phi-2      | Nerdy      | *"calculating optimal escape vector... still cooked"*    |
| Bloom-560m | Chaotic    | *"HAWA MOTO SANA lakini tutaendelea"*                    |
| Flan-T5    | Dramatic   | *"task: survive. confidence: low. executing anyway"*     |


---

## Running Locally

### Backend

```bash
cd backend
pip install uv
uv sync
cp .env.example .env  # add your ANTHROPIC_API_KEY
uv run uvicorn main:app --reload
```

### Frontend

```bash
cd frontend
npm install
npm run dev
```

Then open [http://localhost:3000](http://localhost:3000).

Make sure the frontend is pointing to `http://localhost:8000` for local dev.

---

## Environment Variables

**Backend** (Railway):

```
ANTHROPIC_API_KEY=your_key_here
```

---

## API Endpoints


| Method   | Path                  | Description                          |
| -------- | --------------------- | ------------------------------------ |
| `POST`   | `/start-simulation`   | Spawn agents, generate personalities |
| `POST`   | `/place-scenario`     | Place volcano, start simulation      |
| `GET`    | `/ws/{simulation_id}` | WebSocket stream of tick events      |
| `GET`    | `/simulation/{id}`    | Get current simulation state         |
| `DELETE` | `/simulation/{id}`    | Clean up simulation                  |
| `GET`    | `/health`             | Health check                         |


---

## Roadmap

- More disaster scenarios (earthquake, flood, meteor strike)
- Attack mechanic — models can push each other toward lava
- HuggingFace model logos on map nodes
- Alliance visual — lines between allied models on the map
- Shareable replays
- Win/loss leaderboard across sessions
- 3D renderer (same coordinate system, different view)
- Models react to each other's chat messages for deeper chaos

---

## Architecture Notes

- Backend uses **in-memory state** — simulations live and die with the server instance. Redis persistence is planned but not yet implemented.
- **Claude Sonnet** generates personalities at simulation start (parallel requests). **Claude Haiku** generates chat messages each tick (fast + cheap).
- WebSocket closes cleanly when the simulation finishes or the client disconnects.

---

