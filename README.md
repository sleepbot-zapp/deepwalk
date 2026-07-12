# DEEPWALK

A first-person maze-solving game in the browser: dark corridors, a torch
that lights only what's in front of you, and a new randomly-generated
maze every level.

Built with **React**, **Three.js**, and **Vite**, meant to run on **Bun**.

## Run it

```bash
bun install
bun run dev
```

Then open the local URL Vite prints (usually `http://localhost:5173`).

To build a production bundle:

```bash
bun run build
bun run preview
```

(Don't have Bun? `npm install` / `npm run dev` work identically — the
project has no Bun-specific APIs, just uses it as the package manager
and script runner.)

## Controls

- **W A S D** — move
- **Mouse** — look (click the canvas to lock the pointer)
- **Shift** — run
- **Esc** — release the cursor

## How it's built

- `src/game/maze.js` — maze generation (recursive backtracker) and a BFS
  pass that places the exit at the cell farthest from the start, so each
  level is a real traversal, not a coin-flip.
- `src/game/MazeGame.js` — a framework-agnostic class owning the Three.js
  scene, camera, torch (a `SpotLight` parented to the camera with real
  shadows), collision, and the render loop. It's driven by refs/callbacks
  rather than living inside React's render cycle, since a 60fps game loop
  and React state updates don't mix well.
- `src/App.jsx` — the React shell: menu overlay, HUD (level, timer,
  battery), and wiring `MazeGame` callbacks into React state.

The maze grows each level (from 9×9 up to a capped 25×25), and the torch
has a slow battery drain that makes it flicker under ~25%, without ever
cutting out completely.

## Extending it

Ideas if you want to keep building:
- Footstep/ambient audio
- A minimap toggle
- Fog density scaling with level for more dread
- Persist best times per level (e.g. `localStorage`, works fine here —
  it's just not usable inside Claude's in-chat artifact preview)
