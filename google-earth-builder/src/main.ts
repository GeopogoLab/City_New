import "./style.css";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { GLTFExporter } from "three/examples/jsm/exporters/GLTFExporter.js";
import { OBJLoader } from "three/examples/jsm/loaders/OBJLoader.js";
import type { Group } from "three";
import {
  normalizeModel,
  isValidModelFile,
  formatAltitude,
  extractElevationResult,
  type ElevationApiResponse,
  type ElevationResult,
} from "./utils";
import { DeckScene } from "./deckScene";
import { clampZoom, createInitialViewState, createModelState } from "./state";
import { VIEW_DISTANCE_RANGE, SCALE_RANGE } from "./constants";
import { getGoogleMapsApiKey, getMapboxAccessToken, shouldAutoCenterOnTileset } from "./env";

const mapDiv = document.querySelector<HTMLDivElement>("#map")!;
const fileInput = document.querySelector<HTMLInputElement>("#modelInput")!;
const uploadZone = document.querySelector<HTMLLabelElement>("#uploadZone")!;
const statusLabel = document.querySelector<HTMLSpanElement>("#status")!;
const coordsLabel = document.querySelector<HTMLSpanElement>("#coordinates")!;
const modelControlsPanel = document.querySelector<HTMLElement>("#modelControlsPanel")!;
const searchInput = document.querySelector<HTMLInputElement>("#searchInput")!;
const searchResults = document.querySelector<HTMLDivElement>("#searchResults")!;
const labelsToggle = document.querySelector<HTMLButtonElement>("#labelsToggle")!;
const providerButton = document.querySelector<HTMLButtonElement>("#providerButton")!;
const providerStatus = document.querySelector<HTMLSpanElement>("#providerStatus")!;
const positionLatInput = document.querySelector<HTMLInputElement>("#positionLat")!;
const positionLngInput = document.querySelector<HTMLInputElement>("#positionLng")!;
const centerToCameraButton = document.querySelector<HTMLButtonElement>("#centerToCamera")!;
const startScreen = document.querySelector<HTMLElement>("#startScreen")!;
const startScreenMessage = document.querySelector<HTMLParagraphElement>("#startScreenMessage")!;
const startScreenButton = document.querySelector<HTMLButtonElement>("#startScreenButton")!;
const captureButton = document.querySelector<HTMLButtonElement>("#captureButton")!;
const screenshotModal = document.querySelector<HTMLDivElement>("#screenshotModal")!;
const screenshotPreview = document.querySelector<HTMLImageElement>("#screenshotPreview")!;
const screenshotMessage = document.querySelector<HTMLParagraphElement>("#screenshotMessage")!;
const closeModalButton = document.querySelector<HTMLButtonElement>("#closeModal")!;
const dismissModalButton = document.querySelector<HTMLButtonElement>("#dismissModal")!;
const openAndCopyButton = document.querySelector<HTMLButtonElement>("#openAndCopy")!;
const downloadShotButton = document.querySelector<HTMLButtonElement>("#downloadShot")!;

const scaleSlider = document.querySelector<HTMLInputElement>("#scale")!;
const scaleValue = document.querySelector<HTMLSpanElement>("#scaleValue")!;
const rotationSlider = document.querySelector<HTMLInputElement>("#rotation")!;
const rotationValue = document.querySelector<HTMLSpanElement>("#rotationValue")!;
const pitchSlider = document.querySelector<HTMLInputElement>("#pitch")!;
const pitchValue = document.querySelector<HTMLSpanElement>("#pitchValue")!;
const altitudeSlider = document.querySelector<HTMLInputElement>("#altitude")!;
const altitudeValue = document.querySelector<HTMLSpanElement>("#altitudeValue")!;
const modeButtons = document.querySelectorAll<HTMLButtonElement>("[data-mode]");
const viewDistanceSlider = document.querySelector<HTMLInputElement>("#viewDistance")!;
const viewDistanceValue = document.querySelector<HTMLSpanElement>("#viewDistanceValue")!;
const dropToGroundButton = document.querySelector<HTMLButtonElement>("#dropToGround")!;
const googleMapsApiKey = getGoogleMapsApiKey();
const mapboxAccessToken = getMapboxAccessToken();

let startScreenReady = false;
let startScreenHideTimer: number | null = null;
let startScreenFallbackTimer: number | null = null;
let startScreenLaunchTimer: number | null = null;
type PanDirection = "up" | "down" | "left" | "right";
const PAN_KEY_MAP: Record<string, PanDirection> = {
  w: "up",
  arrowup: "up",
  s: "down",
  arrowdown: "down",
  a: "left",
  arrowleft: "left",
  d: "right",
  arrowright: "right",
};
const activePanKeys = new Set<PanDirection>();
let panAnimationFrame: number | null = null;
let lastPanFrameTs: number | null = null;
let lastScreenshotUrl: string | null = null;
let lastScreenshotBlob: Blob | null = null;

const setStartScreenMessage = (message: string) => {
  startScreenMessage.textContent = message;
};

const showStartScreenLoading = (message: string) => {
  startScreenReady = false;
  startScreen.classList.remove("start-screen--ready", "start-screen--hidden");
  startScreenButton.disabled = true;
  startScreenButton.textContent = "Loading map...";
  setStartScreenMessage(message);
  if (startScreenHideTimer !== null) {
    window.clearTimeout(startScreenHideTimer);
    startScreenHideTimer = null;
  }
  if (startScreenFallbackTimer !== null) {
    window.clearTimeout(startScreenFallbackTimer);
    startScreenFallbackTimer = null;
  }
  startScreen.style.display = "flex";
};

const markStartScreenReady = (message: string) => {
  startScreenReady = true;
  startScreen.classList.add("start-screen--ready");
  startScreenButton.disabled = false;
  startScreenButton.textContent = "Start";
  setStartScreenMessage(`${message} Click Start to enter.`);
  if (startScreenFallbackTimer !== null) {
    window.clearTimeout(startScreenFallbackTimer);
    startScreenFallbackTimer = null;
  }
};

const hideStartScreen = () => {
  if (startScreen.classList.contains("start-screen--hidden")) return;
  startScreen.classList.add("start-screen--hidden");
  startScreenHideTimer = window.setTimeout(() => {
    startScreen.style.display = "none";
  }, 700);
};

const launchIntoApp = (message = "Launching experience...") => {
  if (startScreenLaunchTimer !== null) return;
  startScreen.classList.remove("start-screen--ready");
  startScreen.classList.add("start-screen--launching");
  startScreenButton.disabled = true;
  startScreenButton.textContent = "Starting...";
  setStartScreenMessage(message);
  startScreenLaunchTimer = window.setTimeout(() => {
    hideStartScreen();
    startScreenLaunchTimer = null;
  }, 3000);
};

const clampValue = (value: string | number | null): number => {
  if (typeof value === "number") return value;
  if (value === null || value === "") return VIEW_DISTANCE_RANGE.default;
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : VIEW_DISTANCE_RANGE.default;
};

const clampLatitude = (value: number) => Math.max(-90, Math.min(90, value));
const clampLongitude = (value: number) => Math.max(-180, Math.min(180, value));

const isTypingTarget = (target: EventTarget | null) => {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName.toLowerCase();
  return tag === "input" || tag === "textarea" || target.isContentEditable;
};

const getKeyboardPanStep = (zoom: number) => {
  // Smaller steps when zoomed in, larger when zoomed out.
  const base = 0.0025; // degrees at mid zoom
  const factor = Math.pow(0.6, Math.max(0, zoom - 12));
  return base * factor;
};

const clearPanLoop = () => {
  if (panAnimationFrame !== null) {
    window.cancelAnimationFrame(panAnimationFrame);
    panAnimationFrame = null;
  }
  activePanKeys.clear();
  lastPanFrameTs = null;
};

const tickPanLoop = (timestamp: number) => {
  if (activePanKeys.size === 0) {
    clearPanLoop();
    return;
  }
  const lastTs = lastPanFrameTs ?? timestamp;
  const dt = Math.min(32, timestamp - lastTs); // ms cap to avoid jumps
  lastPanFrameTs = timestamp;

  const step = getKeyboardPanStep(currentViewState.zoom);
  const speedMultiplier = dt / 16.7; // normalize to ~60fps

  let latDelta = 0;
  let lngDelta = 0;
  if (activePanKeys.has("up")) latDelta += step;
  if (activePanKeys.has("down")) latDelta -= step;
  if (activePanKeys.has("left")) lngDelta -= step;
  if (activePanKeys.has("right")) lngDelta += step;

  if (latDelta !== 0 || lngDelta !== 0) {
    deckScene.setViewState({
      latitude: clampLatitude(currentViewState.latitude + latDelta * speedMultiplier),
      longitude: clampLongitude(currentViewState.longitude + lngDelta * speedMultiplier),
    });
  }

  panAnimationFrame = window.requestAnimationFrame(tickPanLoop);
};

const startPanLoopIfNeeded = () => {
  if (panAnimationFrame === null) {
    panAnimationFrame = window.requestAnimationFrame(tickPanLoop);
  }
};

const revokeLastScreenshot = () => {
  if (lastScreenshotUrl) {
    URL.revokeObjectURL(lastScreenshotUrl);
    lastScreenshotUrl = null;
  }
  lastScreenshotBlob = null;
};

const exportGroupToGlbBlob = (group: Group): Promise<Blob> =>
  new Promise((resolve, reject) => {
    gltfExporter.parse(
      group,
      (result) => {
        if (result instanceof ArrayBuffer) {
          resolve(new Blob([result], { type: "model/gltf-binary" }));
        } else if (ArrayBuffer.isView(result)) {
          const view = new Uint8Array(result.buffer, result.byteOffset, result.byteLength);
          const copy = new Uint8Array(view);
          resolve(new Blob([copy.buffer], { type: "model/gltf-binary" }));
        } else if (typeof result === "string") {
          resolve(new Blob([result], { type: "application/json" }));
        } else {
          resolve(new Blob([JSON.stringify(result)], { type: "application/json" }));
        }
      },
      (error) => reject(error),
      { binary: true }
    );
  });

const createScenegraphBlob = async (group: Group): Promise<Blob> => {
  group.updateMatrixWorld(true);
  return await exportGroupToGlbBlob(group);
};

const updateViewDistanceDisplay = (zoom: number) => {
  const clamped = clampZoom(zoom);
  viewDistanceValue.textContent = clamped.toFixed(1);
  const sliderValue = clamped.toFixed(1);
  if (viewDistanceSlider.value !== sliderValue) {
    viewDistanceSlider.value = sliderValue;
  }
};

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

const initialZoom = clampZoom(clampValue(viewDistanceSlider.value));
viewDistanceSlider.min = VIEW_DISTANCE_RANGE.min.toString();
viewDistanceSlider.max = VIEW_DISTANCE_RANGE.max.toString();
viewDistanceSlider.step = "0.1";
viewDistanceSlider.value = initialZoom.toString();
updateViewDistanceDisplay(initialZoom);
scaleSlider.min = SCALE_RANGE.min.toString();
scaleSlider.max = SCALE_RANGE.max.toString();
scaleSlider.step = SCALE_RANGE.step.toString();
scaleSlider.value = SCALE_RANGE.default.toString();

const initialViewState = createInitialViewState(initialZoom);
let currentViewState = initialViewState;

const gltfLoader = new GLTFLoader();
const objLoader = new OBJLoader();
const gltfExporter = new GLTFExporter();
const modelState = createModelState();
let activeMode: "translate" | "rotate" | "scale" = "translate";
let isDraggingModel = false;
let isPlacingModel = false;

const hasActiveModel = () => Boolean(modelState.scenegraphSource);

const deckCanvas = ensureDeckCanvas(mapDiv);

const deckScene = new DeckScene({
  canvas: deckCanvas,
  initialViewState,
  shouldAutoCenter: shouldAutoCenterOnTileset,
  initialCameraMode: "orbit",
  callbacks: {
    onViewStateChange: (viewState) => {
      currentViewState = viewState;
      updateCoordinates(viewState.latitude, viewState.longitude);
      updateViewDistanceDisplay(viewState.zoom);
    },
    onTilesetLoad: () => {
      setStatus("Photorealistic 3D map ready. Load a model to continue.");
      markStartScreenReady("Photorealistic 3D map ready.");
    },
    onTileLoad: (tile) => console.debug("Tile loaded", tile),
    onTileError: (error) => {
      console.error("Tile error:", error);
      setStatus("Failed to load Google photorealistic tiles. Verify API quota.");
      if (!startScreenReady && !startScreen.classList.contains("start-screen--hidden")) {
        startScreenReady = true;
        startScreen.classList.add("start-screen--ready");
        startScreenButton.disabled = false;
        startScreenButton.textContent = "Enter anyway";
        setStartScreenMessage("Tiles could not stream. Check the API quota, or continue to retry in-app.");
        if (startScreenHideTimer !== null) {
          window.clearTimeout(startScreenHideTimer);
          startScreenHideTimer = null;
        }
      }
    },
    onMapClick: ({ latitude, longitude }) => {
      handleMapPlacement(latitude, longitude);
    },
    onModelError: (error) => {
      console.error("Scenegraph load error:", error);
      setStatus("Model failed to render. See console for details.");
    },
    onModelDragStart: ({ latitude, longitude }) => {
      if (!hasActiveModel() || activeMode !== "translate") return;
      isDraggingModel = true;
      setStatus("Dragging model. Release to drop.");
      updateModelPosition(latitude, longitude);
    },
    onModelDrag: ({ latitude, longitude }) => {
      if (!isDraggingModel || !hasActiveModel() || activeMode !== "translate") return;
      updateModelPosition(latitude, longitude);
    },
    onModelDragEnd: () => {
      if (!isDraggingModel) return;
      isDraggingModel = false;
      setStatus("Model moved. Adjust altitude if needed.");
    },
  },
});
updateCaptureAvailability();

deckCanvas.addEventListener("pointerdown", (event) => {
  if (event.ctrlKey) {
    deckScene.setDragMode("rotate");
    event.preventDefault();
  } else if (event.button === 2) {
    deckScene.setDragMode("rotate");
    event.preventDefault();
  } else if (event.button === 0) {
    deckScene.setDragMode("pan");
  }
});

["pointerup", "pointerleave", "pointercancel"].forEach((eventName) => {
  deckCanvas.addEventListener(eventName, () => {
    deckScene.resetDragMode();
  });
});

deckCanvas.addEventListener("contextmenu", (event) => {
  event.preventDefault();
});

const closeScreenshotModal = () => {
  screenshotModal.classList.add("hidden");
};

const openScreenshotModal = () => {
  screenshotModal.classList.remove("hidden");
};

function setStatus(message: string) {
  statusLabel.textContent = message;
  if (!startScreen.classList.contains("start-screen--hidden") && !startScreenReady) {
    setStartScreenMessage(message);
  }
}

function updateCoordinates(lat: number, lng: number) {
  coordsLabel.textContent = `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
}

function updateCaptureAvailability() {
  captureButton.disabled = false;
}

function toggleModelControls(visible: boolean) {
  modelControlsPanel.style.display = visible ? "block" : "none";
  updateCaptureAvailability();
}

function updateModelLayer() {
  deckScene.updateModel(hasActiveModel() ? modelState : null);
  updateCaptureAvailability();
}

const resetTransformControls = () => {
  scaleSlider.value = SCALE_RANGE.default.toString();
  scaleValue.textContent = `${SCALE_RANGE.default.toFixed(2)}x`;
  rotationSlider.value = "0";
  rotationValue.textContent = "0°";
  pitchSlider.value = "0";
  pitchValue.textContent = "0°";
  altitudeSlider.value = "0";
  altitudeValue.textContent = formatAltitude(0);
};

const syncAltitudeControls = () => {
  altitudeSlider.value = modelState.position.altitude.toFixed(0);
  altitudeValue.textContent = formatAltitude(modelState.position.altitude);
};

const syncPositionInputs = () => {
  positionLatInput.value = modelState.position.lat.toFixed(6);
  positionLngInput.value = modelState.position.lng.toFixed(6);
};

const updateModelPosition = (lat: number, lng: number) => {
  modelState.position.lat = clampLatitude(lat);
  modelState.position.lng = clampLongitude(lng);
  syncPositionInputs();
  updateModelLayer();
};

const parseCoordinateInput = (value: string, fallback: number) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const commitPositionInputs = () => {
  if (!hasActiveModel()) {
    setStatus("Load a model before adjusting position.");
    return;
  }
  const lat = clampLatitude(parseCoordinateInput(positionLatInput.value, modelState.position.lat));
  const lng = clampLongitude(parseCoordinateInput(positionLngInput.value, modelState.position.lng));
  updateModelPosition(lat, lng);
  setStatus("Model coordinates updated.");
};

const captureCanvasScreenshot = async (): Promise<Blob | null> => {
  try {
    const blob = await new Promise<Blob | null>((resolve, reject) => {
      deckCanvas.toBlob(
        (b) => (b ? resolve(b) : reject(new Error("Capture failed"))),
        "image/png"
      );
    });
    return blob;
  } catch (error) {
    console.error("Screenshot failed:", error);
    setStatus("Screenshot blocked (likely due to cross-origin tiles).");
    return null;
  }
};

const handleScreenshot = async () => {
  const blob = await captureCanvasScreenshot();
  if (!blob) return;
  revokeLastScreenshot();
  lastScreenshotBlob = blob;
  lastScreenshotUrl = URL.createObjectURL(blob);
  screenshotPreview.src = lastScreenshotUrl;

  let copied = false;
  if ("clipboard" in navigator && "write" in navigator.clipboard) {
    try {
      await navigator.clipboard.write([new ClipboardItem({ "image/png": blob })]);
      copied = true;
      setStatus("Screenshot copied to clipboard.");
    } catch (error) {
      console.warn("Clipboard write failed:", error);
      setStatus("Screenshot captured. Clipboard unavailable for images (browser policy).");
    }
  } else {
    setStatus("Screenshot captured. Clipboard unavailable.");
  }

  screenshotMessage.textContent = copied
    ? "Screenshot copied. What do you want to do next?"
    : "Screenshot captured. Clipboard unavailable—choose next action.";
  openScreenshotModal();
};

const setMode = (mode: typeof activeMode) => {
  activeMode = mode;
  modeButtons.forEach((btn) => btn.classList.toggle("active", btn.dataset.mode === mode));
  if (mode === "translate") {
    setStatus("Move mode: click on the map to reposition the model.");
  } else if (mode === "rotate") {
    setStatus("Rotate mode: use the heading and pitch sliders.");
  } else {
    setStatus("Scale mode: drag the scale slider to resize the model.");
  }
};

let labelsVisible = true;
const setLabelsVisible = (visible: boolean) => {
  labelsVisible = visible;
  labelsToggle.classList.toggle("active", visible);
  labelsToggle.setAttribute("aria-pressed", visible ? "true" : "false");
  labelsToggle.title = visible ? "Hide map labels" : "Show map labels";
  coordsLabel.style.visibility = visible ? "visible" : "hidden";
};

const updateProviderStatus = () => {
  if (!googleMapsApiKey) {
    providerButton.classList.add("error");
    providerStatus.textContent = "MISSING KEY";
    providerButton.title = "Set VITE_GOOGLE_MAPS_API_KEY to enable streaming.";
    return;
  }
  providerButton.classList.remove("error");
  providerStatus.textContent = "READY";
  providerButton.title = "Google photorealistic tiles enabled.";
};

const getElevationService = (): Promise<google.maps.ElevationService | null> | null => {
  return null;
};

type SupportedModelFormat = "gltf" | "glb" | "obj";

const detectModelFormat = (filename: string): SupportedModelFormat | null => {
  const match = filename.toLowerCase().match(/\.([a-z0-9]+)$/);
  if (!match) return null;
  const ext = match[1];
  if (ext === "gltf" || ext === "glb" || ext === "obj") return ext;
  return null;
};

const loadModelFromFile = async (file: File, format: SupportedModelFormat): Promise<Group> => {
  const url = URL.createObjectURL(file);
  try {
    console.debug("Loading model file", { name: file.name, size: file.size, format });
    if (format === "obj") {
      return await objLoader.loadAsync(url);
    }
    const gltf = await gltfLoader.loadAsync(url);
    return gltf.scene;
  } finally {
    URL.revokeObjectURL(url);
  }
};

toggleModelControls(false);
updateCoordinates(initialViewState.latitude, initialViewState.longitude);
setLabelsVisible(labelsVisible);
updateProviderStatus();

const fetchGroundAltitude = async (lat: number, lng: number): Promise<ElevationResult> => {
  if (!googleMapsApiKey) {
    return {
      altitude: null,
      reason: "Google Maps API key missing or Elevation API not enabled",
    };
  }

  const service = getElevationService();
  if (service) {
    try {
      const svc = await service;
      if (svc) {
        const response = await svc.getElevationForLocations({ locations: [{ lat, lng }] });
        const parsed = extractElevationResult(response as unknown as ElevationApiResponse);
        if (parsed.altitude === null && parsed.reason) {
          console.error("ElevationService missing data:", parsed.reason);
        } else if (parsed.altitude !== null) {
          console.debug("ElevationService altitude(m):", parsed.altitude.toFixed(2));
        }
        return parsed;
      }
    } catch (error) {
      console.error("ElevationService failed:", error);
    }
  }

  try {
    const response = await fetch(
      `https://maps.googleapis.com/maps/api/elevation/json?locations=${lat},${lng}&key=${googleMapsApiKey}`,
      {
        headers: {
          "X-GOOG-API-KEY": googleMapsApiKey,
        },
      }
    );
    const body = (await response.json().catch(() => null)) as ElevationApiResponse | null;
    const parsed = extractElevationResult(body);

    if (!response.ok) {
      console.error("Elevation API error:", response.status, parsed.reason);
      return { altitude: null, reason: parsed.reason ?? response.statusText };
    }

    if (parsed.altitude === null && parsed.reason) {
      console.error("Elevation API missing data:", parsed.reason);
    } else if (parsed.altitude !== null) {
      console.debug("Elevation REST altitude(m):", parsed.altitude.toFixed(2));
    }

    return parsed;
  } catch (error) {
    console.error("Elevation fetch failed:", error);
    return {
      altitude: null,
      reason: error instanceof Error ? error.message : "Unknown error",
    };
  }
};

const dropModelToTerrain = async () => {
  if (!hasActiveModel() || isPlacingModel) return;
  dropToGroundButton.disabled = true;
  const previousLabel = dropToGroundButton.textContent;
  dropToGroundButton.textContent = "Snapping...";
  setStatus("Aligning model with terrain...");
  try {
    const { altitude, reason } = await fetchGroundAltitude(
      modelState.position.lat,
      modelState.position.lng
    );
    if (altitude === null) {
      const errorHint = reason ? `Elevation lookup failed (${reason}).` : "Unable to fetch elevation data.";
      setStatus(`${errorHint} Adjust altitude manually.`);
      return;
    }
    modelState.position.altitude = altitude;
    syncAltitudeControls();
    updateModelLayer();
    setStatus("Model snapped to ground elevation.");
  } finally {
    dropToGroundButton.disabled = false;
    dropToGroundButton.textContent = previousLabel || "Drop to Terrain";
  }
};

const finalizeInitialPlacement = (lat: number, lng: number) => {
  if (!hasActiveModel()) return;
  isPlacingModel = false;
  updateModelPosition(lat, lng);
  setStatus("Model placed. Dropping to terrain...");
  void dropModelToTerrain();
};

const handleMapPlacement = (latitude: number, longitude: number) => {
  if (!hasActiveModel()) {
    setStatus("Load a model before placing it on the map.");
    return;
  }
  if (isPlacingModel) {
    finalizeInitialPlacement(latitude, longitude);
    return;
  }
  if (activeMode !== "translate") {
    setStatus("Switch to Move mode to reposition the model.");
    return;
  }
  if (isDraggingModel) return;
  updateModelPosition(latitude, longitude);
  setStatus("Model moved to selected map location.");
};

const placeModel = async (model: Group, format: SupportedModelFormat) => {
  console.debug("Placing model", { format });
  normalizeModel(model);
  modelState.baseScale = model.scale.x * 0.1; // shrink initial placement to 1/10
  modelState.transform.scale = modelState.baseScale;
  modelState.transform.rotation = 0;
  modelState.transform.pitch = 0;
  modelState.position = {
    lat: currentViewState.latitude,
    lng: currentViewState.longitude,
    altitude: 0,
  };

  const scenegraphBlob = await createScenegraphBlob(model);
  modelState.scenegraphSource = scenegraphBlob;

  toggleModelControls(true);
  resetTransformControls();
  syncAltitudeControls();
  syncPositionInputs();
  isPlacingModel = true;
  setMode("translate");

  updateModelLayer();
  setStatus(`${format.toUpperCase()} model loaded. Move cursor, then click to place on the map.`);
};

type Coordinates = { lat: number; lng: number };
type SearchSuggestion = { label: string; detail: string; location: Coordinates };
type GeocodeResult = { suggestions: SearchSuggestion[]; error?: string };
type MapboxFeature = {
  place_name?: string;
  text?: string;
  center?: [number, number];
};

const clearSearchResults = () => {
  searchResults.innerHTML = "";
  searchResults.classList.add("hidden");
};

const showSearchMessage = (message: string) => {
  searchResults.innerHTML = `<div class="search-results-message">${message}</div>`;
  searchResults.classList.remove("hidden");
};

const renderSearchResults = (items: SearchSuggestion[]) => {
  if (!items.length) {
    clearSearchResults();
    return;
  }
  const list = document.createElement("ul");
  items.forEach((item) => {
    const li = document.createElement("li");
    li.innerHTML = `${item.label}<span class=\"secondary\">${item.detail}</span>`;
    li.addEventListener("click", () => {
      deckScene.setViewState({ latitude: item.location.lat, longitude: item.location.lng });
      setStatus(`Camera centered on ${item.label}`);
      clearSearchResults();
    });
    list.appendChild(li);
  });
  searchResults.innerHTML = "";
  searchResults.appendChild(list);
  searchResults.classList.remove("hidden");
};

const parseLatLngInput = (query: string): Coordinates | null => {
  const match = query.trim().match(/^\s*(-?\d+(\.\d+)?),\s*(-?\d+(\.\d+)?)\s*$/);
  if (!match) return null;
  const lat = Number(match[1]);
  const lng = Number(match[3]);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return null;
  return { lat, lng };
};

const geocodeWithMapbox = async (query: string, token: string): Promise<GeocodeResult> => {
  const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(query)}.json?access_token=${token}&limit=5&autocomplete=true`;
  try {
    const response = await fetch(url);
    if (!response.ok) {
      const text = await response.text();
      return { suggestions: [], error: `Mapbox geocoding failed (${response.status}). ${text}` };
    }
    const body: { features?: MapboxFeature[]; message?: string } = await response.json();
    if (body.message) return { suggestions: [], error: `Mapbox geocoding error: ${body.message}` };
    const features = body.features ?? [];
    const suggestions = features.slice(0, 5).flatMap((f) => {
      if (!f.center || f.center.length < 2) return [];
      const [lng, lat] = f.center;
      const label = f.place_name ?? f.text ?? "Unnamed";
      return [
        {
          label,
          detail: `${lat.toFixed(5)}, ${lng.toFixed(5)}`,
          location: { lat, lng },
        },
      ];
    });
    return { suggestions };
  } catch (error) {
    console.error("Mapbox geocoding fetch failed:", error);
    return { suggestions: [], error: "Mapbox geocoding network error." };
  }
};

const geocodeWithGoogle = async (query: string): Promise<GeocodeResult> => {
  if (!googleMapsApiKey) return { suggestions: [], error: "Google Maps API key missing. Search unavailable." };
  try {
    const response = await fetch(
      `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(query)}&key=${googleMapsApiKey}`
    );
    if (!response.ok) {
      console.error("Geocoding API error:", response.status, response.statusText);
      return {
        suggestions: [],
        error: `Geocoding failed (${response.status}). Check API key/billing/referrer settings.`,
      };
    }
    const body: {
      results?: { formatted_address: string; geometry: { location: Coordinates } }[];
      status?: string;
      error_message?: string;
    } = await response.json();
    if (body.status && body.status !== "OK") {
      const detail = body.error_message ? `: ${body.error_message}` : "";
      return { suggestions: [], error: `Geocoding returned ${body.status}${detail}` };
    }
    if (!body.results?.length) return { suggestions: [] };
    return {
      suggestions: body.results.slice(0, 5).map((r) => ({
        label: r.formatted_address,
        detail: `${r.geometry.location.lat.toFixed(5)}, ${r.geometry.location.lng.toFixed(5)}`,
        location: r.geometry.location,
      })),
    };
  } catch (error) {
    console.error("Geocoding fetch failed:", error);
    return { suggestions: [], error: "Geocoding network error. Check connectivity or CORS." };
  }
};

const geocodeAddress = (query: string): Promise<GeocodeResult> => {
  if (mapboxAccessToken) return geocodeWithMapbox(query, mapboxAccessToken);
  return geocodeWithGoogle(query);
};

let searchDebounce: number | null = null;

const handleSearch = async () => {
  const query = searchInput.value.trim();
  if (!query) {
    clearSearchResults();
    return;
  }

  const latLng = parseLatLngInput(query);
  if (latLng) {
    deckScene.setViewState({
      latitude: latLng.lat,
      longitude: latLng.lng,
    });
    setStatus(`Camera centered on ${latLng.lat.toFixed(5)}, ${latLng.lng.toFixed(5)}`);
    clearSearchResults();
    return;
  }

  if (!mapboxAccessToken && !googleMapsApiKey) {
    setStatus("No geocoding provider configured. Add Mapbox or Google API key.");
    showSearchMessage("No geocoder available. Set VITE_MAPBOX_ACCESS_TOKEN or VITE_GOOGLE_MAPS_API_KEY.");
    return;
  }

  const providerLabel = mapboxAccessToken ? "Mapbox" : "Google";
  setStatus(`Searching for location via ${providerLabel}...`);
  const { suggestions, error } = await geocodeAddress(query);
  if (error) {
    setStatus(error);
    showSearchMessage(error);
    return;
  }
  renderSearchResults(suggestions);
  if (!suggestions.length) {
    setStatus("Unable to locate that address. Try latitude,longitude or refine your search.");
    showSearchMessage("No results. Try a more specific address or lat,lng.");
    return;
  }
  const first = suggestions[0];
  deckScene.setViewState({
    latitude: first.location.lat,
    longitude: first.location.lng,
  });
  setStatus(`Camera centered on ${first.label}`);
};

const handleFileUpload = (file: File) => {
  const format = detectModelFormat(file.name);
  if (!format) {
    setStatus("Only .gltf, .glb or .obj files are supported.");
    return;
  }
  setStatus(`Loading ${format.toUpperCase()} model...`);
  loadModelFromFile(file, format)
    .then((group) => placeModel(group, format))
    .catch((error) => {
      console.error("Model load failed:", error);
      setStatus("Model failed to load. Check console for details.");
    });
};

const bootScene = () => {
  if (!googleMapsApiKey) {
    showStartScreenLoading("Missing VITE_GOOGLE_MAPS_API_KEY. You can still enter to view the UI.");
    startScreenButton.textContent = "Enter without map";
    startScreenButton.disabled = false;
    setStatus("Missing VITE_GOOGLE_MAPS_API_KEY. Photorealistic tiles will not load.");
    startScreenReady = true;
    return;
  }
  showStartScreenLoading("Loading Google photorealistic 3D tiles...");
  setStatus("Loading Google photorealistic 3D tiles...");
  deckScene.initializeLayers(googleMapsApiKey);
  startScreenFallbackTimer = window.setTimeout(() => {
    if (startScreenReady) return;
    startScreenReady = true;
    startScreenButton.disabled = false;
    startScreenButton.textContent = "Enter anyway";
    setStartScreenMessage("Still loading tiles. You can enter while data streams.");
  }, 5000);
};

startScreenButton.addEventListener("click", () => {
  if (!startScreenReady) return;
  launchIntoApp();
});

window.addEventListener("keydown", (event) => {
  if (isTypingTarget(event.target)) return;
  const key = event.key.toLowerCase();
  const direction = PAN_KEY_MAP[key];
  if (!direction) return;
  if (!activePanKeys.has(direction)) {
    activePanKeys.add(direction);
    startPanLoopIfNeeded();
  }
  event.preventDefault();
  event.stopPropagation();
});

window.addEventListener("keyup", (event) => {
  const key = event.key.toLowerCase();
  const direction = PAN_KEY_MAP[key];
  if (!direction) return;
  activePanKeys.delete(direction);
  if (activePanKeys.size === 0) {
    clearPanLoop();
  }
  event.preventDefault();
  event.stopPropagation();
});

window.addEventListener("blur", () => {
  clearPanLoop();
});

viewDistanceSlider.addEventListener("input", () => {
  const zoomValue = clampZoom(Number(viewDistanceSlider.value));
  updateViewDistanceDisplay(zoomValue);
  deckScene.setViewState({ zoom: zoomValue });
});

scaleSlider.addEventListener("input", () => {
  if (!hasActiveModel()) return;
  const raw = parseFloat(scaleSlider.value);
  const multiplier = Math.min(SCALE_RANGE.max, Math.max(SCALE_RANGE.min, raw));
  if (multiplier !== raw) {
    scaleSlider.value = multiplier.toString();
  }
  modelState.transform.scale = modelState.baseScale * multiplier;
  scaleValue.textContent = `${multiplier.toFixed(2)}x`;
  updateModelLayer();
});

rotationSlider.addEventListener("input", () => {
  if (!hasActiveModel()) return;
  const rotation = parseFloat(rotationSlider.value);
  modelState.transform.rotation = rotation;
  rotationValue.textContent = `${Math.round(rotation)}°`;
  updateModelLayer();
});

pitchSlider.addEventListener("input", () => {
  if (!hasActiveModel()) return;
  const pitch = parseFloat(pitchSlider.value);
  modelState.transform.pitch = pitch;
  pitchValue.textContent = `${Math.round(pitch)}°`;
  updateModelLayer();
});

altitudeSlider.addEventListener("input", () => {
  if (!hasActiveModel()) return;
  modelState.position.altitude = Number(altitudeSlider.value);
  altitudeValue.textContent = formatAltitude(modelState.position.altitude);
  updateModelLayer();
});

positionLatInput.addEventListener("change", () => {
  commitPositionInputs();
});

positionLngInput.addEventListener("change", () => {
  commitPositionInputs();
});

[positionLatInput, positionLngInput].forEach((input) => {
  input.addEventListener("keydown", (event) => {
    if (event.key !== "Enter") return;
    event.preventDefault();
    commitPositionInputs();
  });
});

dropToGroundButton.addEventListener("click", (event) => {
  event.preventDefault();
  void dropModelToTerrain();
});

captureButton.addEventListener("click", () => {
  void handleScreenshot();
});

const openGeoPogoAi = () => {
  window.open("https://geopogo.com/ai", "_blank", "noopener");
};

openAndCopyButton.addEventListener("click", () => {
  openGeoPogoAi();
  closeScreenshotModal();
});

downloadShotButton.addEventListener("click", () => {
  if (!lastScreenshotBlob || !lastScreenshotUrl) {
    setStatus("Capture a screenshot first.");
    return;
  }
  const link = document.createElement("a");
  link.href = lastScreenshotUrl;
  link.download = "geopogo-screenshot.jpg";
  link.click();
  setStatus("Screenshot downloaded.");
});

[closeModalButton, dismissModalButton].forEach((btn) => {
  btn.addEventListener("click", () => {
    closeScreenshotModal();
  });
});

const startModelDrag = async (event: PointerEvent) => {
  if (!hasActiveModel() || activeMode !== "translate" || isPlacingModel) return;
  const hit = await deckScene.pickModel({ x: event.clientX, y: event.clientY });
  if (!hit) return;
  isDraggingModel = true;
  deckCanvas.setPointerCapture(event.pointerId);
  updateModelPosition(hit.latitude, hit.longitude);
  setStatus("Dragging model. Release to drop.");
  event.preventDefault();
};

const continueModelDrag = (event: PointerEvent) => {
  if (!isDraggingModel) return;
  const position = deckScene.unproject({ x: event.clientX, y: event.clientY });
  if (position) {
    updateModelPosition(position.latitude, position.longitude);
    setStatus("Dragging model. Release to drop.");
  }
};

const endModelDrag = (event: PointerEvent) => {
  if (!isDraggingModel) return;
  isDraggingModel = false;
  try {
    deckCanvas.releasePointerCapture(event.pointerId);
  } catch (err) {
    console.warn("Pointer capture release failed:", err);
  }
  setStatus("Model moved. Adjust altitude if needed.");
};

deckCanvas.addEventListener("pointerdown", (event) => {
  void startModelDrag(event);
});

deckCanvas.addEventListener("pointermove", (event) => {
  if (isPlacingModel && hasActiveModel()) {
    const position = deckScene.unproject({ x: event.clientX, y: event.clientY });
    if (position) {
      updateModelPosition(position.latitude, position.longitude);
    }
  }
  continueModelDrag(event);
});

deckCanvas.addEventListener("pointerup", (event) => {
  endModelDrag(event);
});

deckCanvas.addEventListener("pointercancel", (event) => {
  endModelDrag(event);
});

centerToCameraButton.addEventListener("click", (event) => {
  event.preventDefault();
  if (!hasActiveModel()) {
    setStatus("Load a model before aligning to camera.");
    return;
  }
  updateModelPosition(currentViewState.latitude, currentViewState.longitude);
  setStatus("Model centered on current camera view.");
});

modeButtons.forEach((btn) =>
  btn.addEventListener("click", () => {
    const mode = btn.dataset.mode as typeof activeMode | undefined;
    if (!mode) return;
    setMode(mode);
  })
);

labelsToggle.addEventListener("click", () => {
  setLabelsVisible(!labelsVisible);
});

fileInput.addEventListener("change", () => {
  const file = fileInput.files?.[0];
  if (!file) return;
  if (!isValidModelFile(file.name)) {
    setStatus("Only .gltf, .glb or .obj files are supported.");
    return;
  }
  handleFileUpload(file);
  fileInput.value = "";
});

uploadZone.addEventListener("dragover", (event) => {
  event.preventDefault();
  uploadZone.classList.add("drag-over");
});

uploadZone.addEventListener("dragleave", () => {
  uploadZone.classList.remove("drag-over");
});

uploadZone.addEventListener("drop", (event) => {
  event.preventDefault();
  uploadZone.classList.remove("drag-over");
  const files = event.dataTransfer?.files;
  if (!files?.length) return;
  const file = files[0];
  if (!isValidModelFile(file.name)) {
    setStatus("Only .gltf, .glb or .obj files are supported.");
    return;
  }
  handleFileUpload(file);
});

searchInput.addEventListener("keydown", (event) => {
  if (event.key !== "Enter") return;
  event.preventDefault();
  void handleSearch();
});

searchInput.addEventListener("input", () => {
  if (searchDebounce) {
    window.clearTimeout(searchDebounce);
  }
  searchDebounce = window.setTimeout(() => {
    void handleSearch();
  }, 250);
});

searchInput.addEventListener("blur", () => {
  window.setTimeout(() => clearSearchResults(), 150);
});

providerButton.addEventListener("click", () => {
  if (!googleMapsApiKey) {
    setStatus("Missing API key. Update VITE_GOOGLE_MAPS_API_KEY and reload.");
    return;
  }
  setStatus("Google photorealistic tiles active.");
});

setStatus("Initializing photorealistic scene...");
bootScene();
