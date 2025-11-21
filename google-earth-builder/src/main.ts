import "./style.css";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { GLTFExporter } from "three/examples/jsm/exporters/GLTFExporter.js";
import { OBJLoader } from "three/examples/jsm/loaders/OBJLoader.js";
import type { Group } from "three";
import { normalizeModel, isValidModelFile, formatAltitude } from "./utils";
import { DeckScene, type CameraMode } from "./deckScene";
import { clampZoom, createInitialViewState, createModelState } from "./state";
import { VIEW_DISTANCE_RANGE } from "./constants";
import { getGoogleMapsApiKey, shouldAutoCenterOnTileset } from "./env";

const mapDiv = document.querySelector<HTMLDivElement>("#map")!;
const fileInput = document.querySelector<HTMLInputElement>("#modelInput")!;
const uploadZone = document.querySelector<HTMLLabelElement>("#uploadZone")!;
const statusLabel = document.querySelector<HTMLSpanElement>("#status")!;
const coordsLabel = document.querySelector<HTMLSpanElement>("#coordinates")!;
const modelControlsPanel = document.querySelector<HTMLElement>("#modelControlsPanel")!;
const searchInput = document.querySelector<HTMLInputElement>("#searchInput")!;
const labelsToggle = document.querySelector<HTMLButtonElement>("#labelsToggle")!;
const providerButton = document.querySelector<HTMLButtonElement>("#providerButton")!;
const providerStatus = document.querySelector<HTMLSpanElement>("#providerStatus")!;
const positionLatInput = document.querySelector<HTMLInputElement>("#positionLat")!;
const positionLngInput = document.querySelector<HTMLInputElement>("#positionLng")!;
const centerToCameraButton = document.querySelector<HTMLButtonElement>("#centerToCamera")!;

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
const cameraModeButtons = document.querySelectorAll<HTMLButtonElement>("[data-camera]");
const googleMapsApiKey = getGoogleMapsApiKey();

const clampValue = (value: string | number | null): number => {
  if (typeof value === "number") return value;
  if (value === null || value === "") return VIEW_DISTANCE_RANGE.default;
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : VIEW_DISTANCE_RANGE.default;
};

const clampLatitude = (value: number) => Math.max(-90, Math.min(90, value));
const clampLongitude = (value: number) => Math.max(-180, Math.min(180, value));

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

const createScenegraphUrl = async (group: Group): Promise<string> => {
  group.updateMatrixWorld(true);
  const blob = await exportGroupToGlbBlob(group);
  return URL.createObjectURL(blob);
};

const updateViewDistanceDisplay = (zoom: number) => {
  const clamped = clampZoom(zoom);
  viewDistanceValue.textContent = clamped.toFixed(0);
  const sliderValue = clamped.toString();
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
viewDistanceSlider.value = initialZoom.toString();
updateViewDistanceDisplay(initialZoom);

const initialViewState = createInitialViewState(initialZoom);
let currentViewState = initialViewState;

const gltfLoader = new GLTFLoader();
const objLoader = new OBJLoader();
const gltfExporter = new GLTFExporter();
const modelState = createModelState();
let activeMode: "translate" | "rotate" | "scale" = "translate";

const clearScenegraphUrl = () => {
  if (modelState.scenegraphUrl) {
    URL.revokeObjectURL(modelState.scenegraphUrl);
    modelState.scenegraphUrl = null;
  }
};

const setScenegraphUrl = (url: string) => {
  clearScenegraphUrl();
  modelState.scenegraphUrl = url;
};

const hasActiveModel = () => Boolean(modelState.scenegraphUrl);

const deckScene = new DeckScene({
  canvas: ensureDeckCanvas(mapDiv),
  initialViewState,
  shouldAutoCenter: shouldAutoCenterOnTileset,
  initialCameraMode: "orbit",
  callbacks: {
    onViewStateChange: (viewState) => {
      currentViewState = viewState;
      updateCoordinates(viewState.latitude, viewState.longitude);
      updateViewDistanceDisplay(viewState.zoom);
    },
    onTilesetLoad: () => setStatus("Photorealistic 3D map ready. Load a model to continue."),
    onTileLoad: (tile) => console.debug("Tile loaded", tile),
    onTileError: (error) => {
      console.error("Tile error:", error);
      setStatus("Failed to load Google photorealistic tiles. Verify API quota.");
    },
    onMapClick: ({ latitude, longitude }) => {
      handleMapPlacement(latitude, longitude);
    },
  },
});

const setStatus = (message: string) => {
  statusLabel.textContent = message;
};

const updateCoordinates = (lat: number, lng: number) => {
  coordsLabel.textContent = `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
};

const toggleModelControls = (visible: boolean) => {
  modelControlsPanel.style.display = visible ? "block" : "none";
};

const updateModelLayer = () => {
  deckScene.updateModel(hasActiveModel() ? modelState : null);
};

const resetTransformControls = () => {
  scaleSlider.value = "1";
  scaleValue.textContent = "1.0x";
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

let cameraMode: CameraMode = "orbit";
const setCameraMode = (mode: CameraMode) => {
  cameraMode = mode;
  cameraModeButtons.forEach((btn) => btn.classList.toggle("active", btn.dataset.camera === mode));
  deckScene.setCameraMode(mode);
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
setCameraMode(cameraMode);
setLabelsVisible(labelsVisible);
updateProviderStatus();

const fetchGroundAltitude = async (lat: number, lng: number): Promise<number | null> => {
  if (!googleMapsApiKey) return null;
  try {
    const response = await fetch(
      `https://maps.googleapis.com/maps/api/elevation/json?locations=${lat},${lng}&key=${googleMapsApiKey}`
    );
    if (!response.ok) {
      console.error("Elevation API error:", response.statusText);
      return null;
    }
    const body: { results?: { elevation: number }[] } = await response.json();
    if (!body.results?.length) return null;
    return body.results[0].elevation;
  } catch (error) {
    console.error("Elevation fetch failed:", error);
    return null;
  }
};

const dropModelToTerrain = async () => {
  if (!hasActiveModel()) return;
  dropToGroundButton.disabled = true;
  const previousLabel = dropToGroundButton.textContent;
  dropToGroundButton.textContent = "Snapping...";
  setStatus("Aligning model with terrain...");
  try {
    const altitude = await fetchGroundAltitude(modelState.position.lat, modelState.position.lng);
    if (altitude === null) {
      setStatus("Unable to fetch elevation data. Adjust altitude manually.");
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

const handleMapPlacement = (latitude: number, longitude: number) => {
  if (!hasActiveModel()) {
    setStatus("Load a model before placing it on the map.");
    return;
  }
  if (activeMode !== "translate") {
    setStatus("Switch to Move mode to reposition the model.");
    return;
  }
  updateModelPosition(latitude, longitude);
  setStatus("Model moved to selected map location.");
};

const placeModel = async (model: Group, format: SupportedModelFormat) => {
  normalizeModel(model);
  modelState.baseScale = model.scale.x;
  modelState.transform.scale = modelState.baseScale;
  modelState.transform.rotation = 0;
  modelState.transform.pitch = 0;
  modelState.position = {
    lat: currentViewState.latitude,
    lng: currentViewState.longitude,
    altitude: 0,
  };

  const scenegraphUrl = await createScenegraphUrl(model);
  setScenegraphUrl(scenegraphUrl);

  toggleModelControls(true);
  resetTransformControls();
  syncAltitudeControls();
  syncPositionInputs();
  setMode("translate");

  updateModelLayer();
  setStatus(`${format.toUpperCase()} model loaded. Dropping to terrain...`);
  void dropModelToTerrain();
};

type Coordinates = { lat: number; lng: number };

const geocodeAddress = async (query: string): Promise<Coordinates | null> => {
  if (!googleMapsApiKey) return null;
  try {
    const response = await fetch(
      `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(query)}&key=${googleMapsApiKey}`
    );
    if (!response.ok) {
      console.error("Geocoding API error:", response.statusText);
      return null;
    }
    const body: {
      results?: { geometry: { location: Coordinates } }[];
      status?: string;
    } = await response.json();
    if (!body.results?.length || body.status === "ZERO_RESULTS") return null;
    return body.results[0].geometry.location;
  } catch (error) {
    console.error("Geocoding fetch failed:", error);
    return null;
  }
};

const handleSearch = async () => {
  const query = searchInput.value.trim();
  if (!query) return;
  if (!googleMapsApiKey) {
    setStatus("Google Maps API key missing. Search unavailable.");
    return;
  }
  setStatus("Searching for location...");
  const result = await geocodeAddress(query);
  if (!result) {
    setStatus("Unable to locate that address. Try latitude,longitude or refine your search.");
    return;
  }
  deckScene.setViewState({
    latitude: result.lat,
    longitude: result.lng,
  });
  setStatus(`Camera centered on ${query}`);
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
      console.error(error);
      setStatus("Model failed to load. Check console for details.");
    });
};

const bootScene = () => {
  if (!googleMapsApiKey) {
    setStatus("Missing VITE_GOOGLE_MAPS_API_KEY. Cannot stream photorealistic Google Earth data.");
    return;
  }
  setStatus("Loading Google photorealistic 3D tiles...");
  deckScene.initializeLayers(googleMapsApiKey);
};

viewDistanceSlider.addEventListener("input", () => {
  const zoomValue = clampZoom(Number(viewDistanceSlider.value));
  updateViewDistanceDisplay(zoomValue);
  deckScene.setViewState({ zoom: zoomValue });
});

scaleSlider.addEventListener("input", () => {
  if (!hasActiveModel()) return;
  const multiplier = parseFloat(scaleSlider.value);
  modelState.transform.scale = modelState.baseScale * multiplier;
  scaleValue.textContent = `${multiplier.toFixed(1)}x`;
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

cameraModeButtons.forEach((btn) =>
  btn.addEventListener("click", () => {
    const mode = btn.dataset.camera as CameraMode | undefined;
    if (!mode || mode === cameraMode) return;
    setCameraMode(mode);
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

providerButton.addEventListener("click", () => {
  if (!googleMapsApiKey) {
    setStatus("Missing API key. Update VITE_GOOGLE_MAPS_API_KEY and reload.");
    return;
  }
  setStatus("Google photorealistic tiles active.");
});

window.addEventListener("beforeunload", () => {
  clearScenegraphUrl();
});

setStatus("Initializing photorealistic scene...");
bootScene();
