Review or implement the requested task using Ghost Browser's React renderer patterns.

## Stack
- **React 18** (StrictMode)
- **TypeScript** — strict mode
- **Tailwind CSS v3** with custom `ghost-*` color palette and component classes
- **Zustand** for global state — no Context API, no prop drilling
- **lucide-react** for icons (tree-shakeable, consistent stroke style)
- **IPC** via `window.api.*` (exposed by preload via contextBridge)

---

## Component Structure

```
src/renderer/src/
├── App.tsx                          ← root: Sidebar + active section
├── components/
│   ├── Layout/
│   │   ├── Sidebar.tsx              ← nav, profile/session counts
│   │   └── Header.tsx               ← title, search input, action slot
│   ├── ProfileManager/
│   │   ├── index.tsx                ← list view + polling active sessions
│   │   ├── ProfileCard.tsx          ← single card with launch/close/delete
│   │   └── CreateProfileModal.tsx   ← modal form
│   ├── ProxyManager/
│   │   └── index.tsx                ← add form inline + proxy list
│   └── FingerprintEditor/
│       └── index.tsx                ← vector status dashboard (read-only MVP)
├── stores/
│   ├── profileStore.ts
│   └── proxyStore.ts
└── types/index.ts                   ← re-exports shared types + renderer-only types
```

---

## Tailwind Component Classes

Defined in `src/renderer/src/index.css` — use these instead of raw utility strings:

```tsx
<button className="btn-primary">Primary action</button>
<button className="btn-secondary">Cancel</button>
<button className="btn-danger">Delete</button>
<button className="btn-ghost">Icon button</button>
<input className="input" />
<div className="card">Card container</div>

// Badges
<span className="badge-green">Healthy</span>
<span className="badge-red">Failed</span>
<span className="badge-yellow">Warning</span>
<span className="badge-blue">Info</span>
```

Custom colors: `ghost-{50..950}` (indigo-based, the brand purple).

---

## Zustand Store Pattern

```typescript
// stores/myStore.ts
import { create } from 'zustand'

interface MyState {
  items: Item[]
  loading: boolean
  fetchItems: () => Promise<void>
  createItem: (input: CreateInput) => Promise<void>
}

export const useMyStore = create<MyState>((set, get) => ({
  items: [],
  loading: false,

  fetchItems: async () => {
    set({ loading: true })
    try {
      const items = await window.api.myFeature.list()
      set({ items, loading: false })
    } catch {
      set({ loading: false })
    }
  },

  createItem: async (input) => {
    const item = await window.api.myFeature.create(input)
    set((s) => ({ items: [item, ...s.items] }))
  },
}))
```

Rules:
- One store per domain (profiles, proxies, etc.)
- Stores own the `window.api.*` calls — components just call store methods
- `loading` is per-store, not per-component (unless a specific component needs its own)
- Optimistic updates: update local state immediately, no need to re-fetch after create/delete

---

## Component Patterns

### Page Layout
```tsx
export function MySection() {
  return (
    <div className="flex flex-col h-full">
      <Header
        title="My Section"
        subtitle="description"
        search={search}
        onSearchChange={setSearch}
        actions={<button className="btn-primary">Add</button>}
      />
      <div className="flex-1 overflow-y-auto p-6">
        {/* content */}
      </div>
    </div>
  )
}
```

### Modal Pattern
```tsx
// Parent manages open/close state
const [showModal, setShowModal] = useState(false)

// Modal renders into fixed overlay
function MyModal({ onClose }: { onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-slate-800 border border-slate-700 rounded-2xl w-full max-w-md p-6 shadow-2xl">
        {/* content */}
        <div className="flex justify-end gap-3 mt-6">
          <button onClick={onClose} className="btn-secondary text-sm">Cancel</button>
          <button onClick={submit} className="btn-primary text-sm">Confirm</button>
        </div>
      </div>
    </div>
  )
}
```

### Loading / Empty States
```tsx
// Loading
{loading && items.length === 0 && (
  <div className="flex items-center justify-center h-40 text-slate-500 text-sm">
    Loading...
  </div>
)}

// Empty
{!loading && items.length === 0 && (
  <div className="flex flex-col items-center justify-center h-60 text-center">
    <div className="text-4xl mb-3">👻</div>
    <p className="text-slate-400 font-medium">No items yet</p>
    <p className="text-slate-500 text-sm mt-1 mb-4">Description of what to do</p>
    <button onClick={openCreate} className="btn-primary text-sm flex items-center gap-2">
      <Plus className="w-4 h-4" /> Create
    </button>
  </div>
)}
```

---

## Adding a New Section

1. **Add nav entry** in `src/renderer/src/components/Layout/Sidebar.tsx`:
```typescript
const NAV_ITEMS = [
  // ... existing
  { key: 'mySection', icon: MyIcon, label: 'My Section' }
]
```

2. **Add type** in `src/renderer/src/types/index.ts`:
```typescript
export type NavSection = 'profiles' | 'proxies' | 'fingerprint' | 'settings' | 'mySection'
```

3. **Create component** `src/renderer/src/components/MySection/index.tsx`

4. **Wire in App.tsx**:
```tsx
{section === 'mySection' && <MySection />}
```

5. **Create store** if needed: `src/renderer/src/stores/mySectionStore.ts`

6. **Wire IPC**: main handler → preload bridge → env.d.ts type → store call

---

## IPC Calls from Renderer

```typescript
// Always use window.api.* (never ipcRenderer directly — not accessible in renderer)
// All IPC calls return Promises

// In store:
const profiles = await window.api.profiles.list()

// Errors propagate from main process throws:
try {
  await window.api.profiles.launch(id)
} catch (e: any) {
  setError(e.message)
}
```

---

## Styling Rules

- **Dark theme only** — CSS vars defined in `:root` (`--bg-primary: #0f172a`, etc.)
- **No inline style** — always Tailwind classes
- **Hover states**: `hover:bg-slate-700`, `hover:border-slate-600`
- **Transitions**: `transition-colors` on interactive elements
- **Text hierarchy**: `text-white` (primary), `text-slate-200` (secondary), `text-slate-400` (muted), `text-slate-500` (hint)
- **Border**: `border-slate-700` (cards), `border-slate-800` (layout dividers)
- **Accent**: `ghost-600` / `ghost-400` for selected, active, focus states
- **Font mono**: `font-mono` for IPs, ports, UUIDs, version strings

---

## Active Session Polling

The ProfileManager polls active sessions every 3 seconds to show which profiles are running:

```typescript
useEffect(() => {
  const interval = setInterval(fetchActiveSessions, 3000)
  return () => clearInterval(interval)
}, [])
```

Active profiles show a pulsing green indicator (`animate-ping`). Inactive profiles show the Launch button. This pattern can be reused for any real-time status polling.
