# Google Earth Builder

A lightweight Vite + TypeScript experience for streaming Google Photorealistic 3D tiles with Deck.gl, importing GLB/GLTF models, and aligning them to real-world terrain. The UI keeps the canvas full-bleed while critical controls float as translucent glass panels.

## Requirements

- Node.js 20+
- pnpm/npm for running scripts (repo currently uses npm + lockfile)
- Google Maps Platform key with **Photorealistic 3D Tiles** and **Elevation** APIs enabled

## Getting Started

1. Install dependencies:
   ```bash
   npm install
   ```
2. Copy the sample environment and fill the key:
   ```bash
   cp .env.example .env
   # edit .env to add VITE_GOOGLE_MAPS_API_KEY
   ```
3. Start the dev server:
   ```bash
   npm run dev
   ```
   The canvas streams tiles once the key is detected. Use the floating upload panel to import GLB/GLTF models.

## Available Scripts

| Script | Description |
| --- | --- |
| `npm run dev` | Start Vite dev server |
| `npm run build` | Type-check and produce a production bundle |
| `npm run preview` | Preview the production build |
| `npm run test` | Run Vitest in watch mode |
| `npm run test:run` | Run Vitest once in CI |

## Key Features

- Shared application state modules (`state.ts`, `deckScene.ts`) keep camera + model data synchronized with Deck.gl
- Search bar now geocodes addresses or `lat,lng` pairs using the same Google key and re-centers the camera
- Camera mode toggle flips between orbit and free rotate modes without reloading the scene
- Status-aware provider button and label toggle expose API-key health plus quick coordinate overlays
- Terrain snapping uses the Elevation API to ground uploaded models with a single click

## Testing

Run unit tests locally:

```bash
npm run test:run
```

Vitest covers utility helpers (`utils.ts`) and the new view-state helpers. Add tests for any new helpers or data flows to keep regressions out of the rendering pipeline.
