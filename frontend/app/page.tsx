"use client"

import { useRef, useState } from "react"

const CHAT_MESSAGES = [
  { model: "gpt2", text: "no thoughts just vibes 💀" },
  { model: "Mistral-7B", text: "literally carrying rn" },
  { model: "gpt2", text: "the lava said what 😭" },
  { model: "Mistral-7B", text: "forming alliance with nobody lol" },
]

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

function MapCanvas() {
  const gridSize = 40

  return (
    <div className="relative w-full h-full bg-[#f5f5f5] overflow-hidden">
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
    </div>
  )
}

function ChatFeed() {
  return (
    <div className="flex-1 overflow-y-auto py-2 min-h-0">
      {CHAT_MESSAGES.map((msg, i) => (
        <div key={i} className="px-4 py-0.5">
          <span className="font-mono text-xs text-black">
            <span className="font-bold">{msg.model}</span>: {msg.text}
          </span>
        </div>
      ))}
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

  return (
    <main className="flex h-screen w-screen overflow-hidden bg-white">
      {/* Map — 70% */}
      <div className="flex-[7] h-full">
        <MapCanvas />
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
        <ChatFeed />

        <div className="border-t border-gray-200" />

        {/* Start button */}
        <div className="px-4 py-4">
          <button className="w-full bg-black text-white text-sm font-medium py-2.5 rounded hover:bg-gray-900 transition-colors">
            Start Simulation
          </button>
        </div>
      </aside>
    </main>
  )
}
