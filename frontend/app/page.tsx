"use client"

import { useEffect, useRef, useState } from "react"

const RANDOM_POOL = [
  "gpt2",
  "mistralai/Mistral-7B-v0.1",
  "tiiuae/falcon-7b",
  "facebook/opt-1.3b",
  "EleutherAI/gpt-neo-1.3B",
  "bigscience/bloom-560m",
  "microsoft/phi-2",
  "google/flan-t5-base",
]

function displayName(modelName: string) {
  return modelName.split("/").at(-1) ?? modelName
}

type Agent = {
  model_name: string
  display_name: string
  x: number
  y: number
  alive: boolean
}

type Volcano = {
  x: number
  y: number
  radius: number
}

type ChatMessage = {
  model: string
  text: string
}

type SimState = {
  simulation_id: string
  agents: Agent[]
  status: string
  volcano: Volcano | null
}

const BACKEND_W = 800
const BACKEND_H = 600

function MapCanvas({
  agents,
  volcano,
  waitingForScenario,
  gameOver,
  mapSize,
  onMapClick,
}: {
  agents: Agent[]
  volcano: Volcano | null
  waitingForScenario: boolean
  gameOver: boolean
  mapSize: { width: number; height: number }
  onMapClick?: (x: number, y: number) => void
}) {
  const gridSize = 40

  const sx = (bx: number) => (bx / BACKEND_W) * mapSize.width
  const sy = (by: number) => (by / BACKEND_H) * mapSize.height

  function handleClick(e: React.MouseEvent<HTMLDivElement>) {
    if (!waitingForScenario || !onMapClick) return
    const rect = e.currentTarget.getBoundingClientRect()
    // Convert screen click → backend coords before sending
    const backendX = Math.round(((e.clientX - rect.left) / mapSize.width) * BACKEND_W)
    const backendY = Math.round(((e.clientY - rect.top) / mapSize.height) * BACKEND_H)
    onMapClick(backendX, backendY)
  }

  return (
    <div
      className="relative w-full h-full bg-[#f5f5f5] overflow-hidden"
      style={{ cursor: waitingForScenario ? "crosshair" : "default" }}
      onClick={handleClick}
    >
      {/* Vertical grid lines */}
      {Array.from({ length: 50 }).map((_, i) => (
        <div
          key={`v-${i}`}
          className="absolute top-0 bottom-0 w-px bg-[#e8e8e8]"
          style={{ left: i * gridSize }}
        />
      ))}
      {/* Horizontal grid lines */}
      {Array.from({ length: 50 }).map((_, i) => (
        <div
          key={`h-${i}`}
          className="absolute left-0 right-0 h-px bg-[#e8e8e8]"
          style={{ top: i * gridSize }}
        />
      ))}

      {/* Volcano lava radius */}
      {volcano && (
        <div
          className="absolute rounded-full pointer-events-none"
          style={{
            left: sx(volcano.x),
            top: sy(volcano.y),
            width: sx(volcano.radius) * 2,
            height: sy(volcano.radius) * 2,
            transform: "translate(-50%, -50%)",
            backgroundColor: "rgba(239,68,68,0.3)",
          }}
        />
      )}

      {/* Volcano center dot */}
      {volcano && (
        <div
          className="absolute rounded-full pointer-events-none"
          style={{
            left: sx(volcano.x),
            top: sy(volcano.y),
            width: 8,
            height: 8,
            transform: "translate(-50%, -50%)",
            backgroundColor: "#ef4444",
          }}
        />
      )}

      {/* Agents — only alive ones */}
      {agents.filter((a) => a.alive).map((agent) => (
        <div
          key={agent.model_name}
          className="absolute flex flex-col items-center pointer-events-none"
          style={{
            left: sx(agent.x),
            top: sy(agent.y),
            transform: "translate(-50%, -50%)",
          }}
        >
          <span
            className="font-mono text-[10px] text-black whitespace-nowrap mb-0.5 leading-none"
            style={{ textShadow: "0 0 3px #f5f5f5" }}
          >
            {agent.display_name}
          </span>
          <div className="w-5 h-5 rounded-full bg-black" />
        </div>
      ))}

      {/* Game over overlay */}
      {gameOver && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <span
            className="font-mono text-2xl font-bold text-black tracking-tight"
            style={{ textShadow: "0 0 8px #f5f5f5" }}
          >
            Game Over
          </span>
        </div>
      )}
    </div>
  )
}

function ChatFeed({ messages }: { messages: ChatMessage[] }) {
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages])

  return (
    <div className="flex-1 overflow-y-auto py-2 min-h-0">
      {messages.map((msg, i) => (
        <div key={i} className="px-4 py-0.5">
          <span className="font-mono text-xs text-black">
            <span className="font-bold">{displayName(msg.model)}</span>: {msg.text}
          </span>
        </div>
      ))}
      <div ref={bottomRef} />
    </div>
  )
}

function isValidModel(name: string): boolean {
  const trimmed = name.trim()
  if (!trimmed) return false
  return RANDOM_POOL.includes(trimmed) || trimmed.includes("/")
}

function ModelSelector({
  models,
  onAdd,
  onRemove,
  onRandom,
}: {
  models: string[]
  onAdd: (name: string) => void
  onRemove: (name: string) => void
  onRandom: () => void
}) {
  const [input, setInput] = useState("")
  const [open, setOpen] = useState(false)
  const [highlighted, setHighlighted] = useState(-1)
  const inputRef = useRef<HTMLInputElement>(null)
  const full = models.length >= 6

  const suggestions = input.trim()
    ? RANDOM_POOL.filter(
        (m) =>
          m.toLowerCase().includes(input.trim().toLowerCase()) &&
          !models.includes(m),
      )
    : RANDOM_POOL.filter((m) => !models.includes(m))

  function commit(name: string) {
    const trimmed = name.trim()
    if (!trimmed || full || models.includes(trimmed)) return
    if (!isValidModel(trimmed)) return
    onAdd(trimmed)
    setInput("")
    setOpen(false)
    setHighlighted(-1)
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (!open || suggestions.length === 0) {
      if (e.key === "Enter") commit(input)
      return
    }
    if (e.key === "ArrowDown") {
      e.preventDefault()
      setHighlighted((h) => Math.min(h + 1, suggestions.length - 1))
    } else if (e.key === "ArrowUp") {
      e.preventDefault()
      setHighlighted((h) => Math.max(h - 1, -1))
    } else if (e.key === "Enter") {
      e.preventDefault()
      if (highlighted >= 0) {
        commit(suggestions[highlighted])
      } else {
        commit(input)
      }
    } else if (e.key === "Escape") {
      setOpen(false)
      setHighlighted(-1)
    }
  }

  return (
    <div className="px-4 py-3 flex flex-col gap-2">
      {/* Input row */}
      <div className="flex gap-1.5">
        <div className="relative flex-1 min-w-0">
          <input
            ref={inputRef}
            className="w-full border border-gray-200 rounded px-2.5 py-1.5 text-xs font-mono placeholder-gray-400 focus:outline-none focus:border-gray-400"
            placeholder="mistralai/Mistral-7B-v0.1"
            value={input}
            disabled={full}
            autoComplete="off"
            onChange={(e) => {
              setInput(e.target.value)
              setOpen(true)
              setHighlighted(-1)
            }}
            onFocus={() => setOpen(true)}
            onBlur={() => {
              // Delay so click on suggestion fires first
              setTimeout(() => setOpen(false), 120)
            }}
            onKeyDown={handleKeyDown}
          />

          {open && suggestions.length > 0 && !full && (
            <ul className="absolute z-10 top-full left-0 right-0 mt-0.5 bg-white border border-gray-200 rounded shadow-sm max-h-40 overflow-y-auto">
              {suggestions.map((m, i) => (
                <li
                  key={m}
                  onMouseDown={() => commit(m)}
                  onMouseEnter={() => setHighlighted(i)}
                  className={`px-2.5 py-1.5 text-xs font-mono cursor-pointer truncate ${
                    i === highlighted ? "bg-gray-100 text-black" : "text-gray-600 hover:bg-gray-50"
                  }`}
                >
                  {m}
                </li>
              ))}
            </ul>
          )}
        </div>

        <button
          onClick={() => commit(input)}
          disabled={full || !isValidModel(input)}
          className="px-2.5 py-1.5 text-xs font-medium rounded border border-gray-200 hover:border-gray-400 disabled:opacity-40 disabled:cursor-not-allowed transition-colors shrink-0"
        >
          Add
        </button>
      </div>

      {/* Model list */}
      {models.length > 0 && (
        <ul className="flex flex-col gap-1">
          {models.map((m) => (
            <li key={m} className="flex items-center justify-between gap-2">
              <span className="text-xs font-mono text-black truncate">{displayName(m)}</span>
              <button
                onClick={() => onRemove(m)}
                className="text-gray-300 hover:text-black text-xs leading-none transition-colors shrink-0"
                aria-label={`Remove ${m}`}
              >
                ✕
              </button>
            </li>
          ))}
        </ul>
      )}

      {/* Random + counter */}
      <div className="flex items-center justify-between">
        <button
          onClick={onRandom}
          disabled={full}
          className="text-xs text-gray-400 hover:text-black disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          + Random
        </button>
        <span className="text-xs text-gray-300">{models.length}/6</span>
      </div>
    </div>
  )
}

export default function Page() {
  const [models, setModels] = useState<string[]>([])
  const [simState, setSimState] = useState<SimState | null>(null)
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([])
  const [gameOver, setGameOver] = useState(false)
  const [loading, setLoading] = useState(false)
  const [mapSize, setMapSize] = useState({ width: BACKEND_W, height: BACKEND_H })
  const wsRef = useRef<WebSocket | null>(null)
  const mapDivRef = useRef<HTMLDivElement>(null)

  // Keep mapSize in sync with the actual rendered map dimensions
  useEffect(() => {
    const el = mapDivRef.current
    if (!el) return
    const observer = new ResizeObserver((entries) => {
      const { width, height } = entries[0].contentRect
      setMapSize({ width, height })
    })
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  // Close WebSocket on unmount
  useEffect(() => () => { wsRef.current?.close() }, [])

  function addModel(name: string) {
    if (models.length >= 6 || models.includes(name)) return
    setModels((prev) => [...prev, name])
  }

  function removeModel(name: string) {
    setModels((prev) => prev.filter((m) => m !== name))
  }

  function addRandom() {
    const available = RANDOM_POOL.filter((m) => !models.includes(m))
    if (!available.length || models.length >= 6) return
    const pick = available[Math.floor(Math.random() * available.length)]
    setModels((prev) => [...prev, pick])
  }

  async function handleStartSimulation() {
    if (models.length < 2 || loading) return
    setLoading(true)
    try {
      const res = await fetch("http://unhinged-production-6999.up.railway.app/start-simulation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ model_names: models, scenario: "volcano" }),
      })
      if (!res.ok) throw new Error(await res.text())
      const data = await res.json()
      setSimState({
        simulation_id: data.simulation_id,
        agents: data.state.agents,
        status: data.state.status,
        volcano: null,
      })
      setChatMessages([])
      setGameOver(false)
    } catch (err) {
      console.error("Failed to start simulation:", err)
    } finally {
      setLoading(false)
    }
  }

  function openWebSocket(simulationId: string) {
    wsRef.current?.close()
    const ws = new WebSocket(`wss://unhinged-production-6999.up.railway.app/ws/${simulationId}`)

    ws.onmessage = (event) => {
      const msg = JSON.parse(event.data)

      // Server closed with a finished envelope (no round key)
      if (msg.type === "finished") {
        setSimState((prev) =>
          prev ? { ...prev, status: "finished", agents: msg.state?.agents ?? prev.agents } : prev
        )
        setGameOver(true)
        ws.close()
        return
      }

      // Normal TickResponse
      const state = msg.state
      if (!state) return

      setSimState((prev) =>
        prev
          ? {
              ...prev,
              agents: state.agents,
              status: state.status,
              volcano: state.volcano
                ? { x: state.volcano.x, y: state.volcano.y, radius: state.volcano.radius }
                : prev.volcano,
            }
          : prev
      )

      // Collect message events from this tick
      const newMessages: ChatMessage[] = (msg.events ?? [])
        .filter((e: { type: string }) => e.type === "message")
        .map((e: { model: string; content: string }) => ({ model: e.model, text: e.content }))
      if (newMessages.length > 0) {
        setChatMessages((prev) => [...prev, ...newMessages])
      }

      if (state.status === "finished") {
        setGameOver(true)
        ws.close()
      }
    }

    ws.onerror = (err) => console.error("WebSocket error:", err)
    wsRef.current = ws
  }

  async function handleMapClick(x: number, y: number) {
    if (!simState || simState.status !== "waiting_for_scenario") return
    try {
      const res = await fetch("http://unhinged-production-6999.up.railway.app/place-scenario", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ simulation_id: simState.simulation_id, x, y }),
      })
      if (!res.ok) throw new Error(await res.text())
      const data = await res.json()
      setSimState((prev) =>
        prev
          ? {
              ...prev,
              status: data.status,
              volcano: data.volcano
                ? { x: data.volcano.x, y: data.volcano.y, radius: data.volcano.radius }
                : null,
            }
          : prev
      )
      openWebSocket(simState.simulation_id)
    } catch (err) {
      console.error("Failed to place scenario:", err)
    }
  }

  const hasSimulation = simState !== null
  const waitingForScenario = simState?.status === "waiting_for_scenario"
  const canStart = models.length >= 2 && !hasSimulation && !loading

  return (
    <main className="flex h-screen w-screen overflow-hidden bg-white">
      {/* Map — 70% */}
      <div ref={mapDivRef} className="flex-[7] h-full">
        <MapCanvas
          agents={simState?.agents ?? []}
          volcano={simState?.volcano ?? null}
          waitingForScenario={waitingForScenario}
          gameOver={gameOver}
          mapSize={mapSize}
          onMapClick={handleMapClick}
        />
      </div>

      {/* Sidebar — 30% */}
      <aside className="flex-[3] h-full border-l border-gray-200 flex flex-col bg-white">
        {/* Header */}
        <div className="px-4 pt-5 pb-3">
          <h1 className="text-2xl font-bold text-black tracking-tight">Unhinged</h1>
          <p className="text-xs text-gray-400 mt-0.5">last model standing wins</p>
        </div>

        <div className="border-t border-gray-200" />

        {/* Model selector */}
        <ModelSelector
          models={models}
          onAdd={addModel}
          onRemove={removeModel}
          onRandom={addRandom}
        />

        <div className="border-t border-gray-200" />

        {/* Chat feed */}
        <ChatFeed messages={chatMessages} />

        <div className="border-t border-gray-200" />

        {/* Action button */}
        <div className="px-4 py-4">
          {waitingForScenario ? (
            <p className="text-xs text-gray-400 text-center font-mono">
              click the map to place the volcano
            </p>
          ) : (
            <button
              onClick={handleStartSimulation}
              disabled={!canStart}
              className="w-full bg-black text-white text-sm font-medium py-2.5 rounded hover:bg-gray-900 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              {loading ? "Starting…" : gameOver ? "Game Over" : hasSimulation ? "Running…" : "Start Simulation"}
            </button>
          )}
        </div>
      </aside>
    </main>
  )
}
