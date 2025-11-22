import React from "react";
import ReactDOM from "react-dom/client";
import "./style.css";
import { DeckScene } from "./deckScene";
import { createInitialViewState } from "./state";
import { getGoogleMapsApiKey, shouldAutoCenterOnTileset } from "./env";
import ViewerSettingsPanel from "./components/ViewerSettingsPanel";

const mapDiv = document.querySelector<HTMLDivElement>("#map")!;
const googleMapsApiKey = getGoogleMapsApiKey();

const ensureDeckCanvas = (container: HTMLElement): HTMLCanvasElement => {
  const existingCanvas = container.querySelector<HTMLCanvasElement>("#deck-canvas");
  if (existingCanvas) {
    return existingCanvas;
  }
  const canvas = document.createElement("canvas");
  canvas.id = "deck-canvas";
  canvas.style.position = "absolute";
  canvas.style.top = "0";
  canvas.style.left = "0";
  canvas.style.width = "100%";
  canvas.style.height = "100%";
  container.appendChild(canvas);
  return canvas;
};

const initialViewState = createInitialViewState(15);
const deckCanvas = ensureDeckCanvas(mapDiv);

const deckScene = new DeckScene({
  canvas: deckCanvas,
  initialViewState,
  shouldAutoCenter: shouldAutoCenterOnTileset,
  initialCameraMode: "orbit",
  callbacks: {
    onViewStateChange: (viewState) => {
      console.log("View state changed", viewState);
    },
    onTilesetLoad: () => console.log("Photorealistic 3D map ready."),
    onTileLoad: (tile) => console.debug("Tile loaded", tile),
    onTileError: (error) => {
      console.error("Tile error:", error);
    },
    onMapClick: ({ latitude, longitude }) => {
      console.log("Map clicked", { latitude, longitude });
    },
    onModelError: (error) => {
      console.error("Scenegraph load error:", error);
    },
  },
});

const bootScene = () => {
  if (!googleMapsApiKey) {
    console.error("Missing VITE_GOOGLE_MAPS_API_KEY. Cannot stream photorealistic Google Earth data.");
    return;
  }
  console.log("Loading Google photorealistic 3D tiles...");
  deckScene.initializeLayers(googleMapsApiKey);
};

bootScene();

const root = ReactDOM.createRoot(document.getElementById("root")!);
root.render(
  <React.StrictMode>
    <ViewerSettingsPanel />
  </React.StrictMode>
);
