import { Deck, AmbientLight, DirectionalLight, LightingEffect } from "@deck.gl/core";
import { Tile3DLayer } from "@deck.gl/geo-layers";
import { ScenegraphLayer } from "@deck.gl/mesh-layers";
import { Tiles3DLoader } from "@loaders.gl/3d-tiles";
import type { Tileset3D } from "@loaders.gl/tiles";
import type { CameraViewState, ModelState } from "./state";
import { clampZoom } from "./state";
import { buildGoogleTilesUrl } from "./env";
import { MODEL_BASE_SIZE } from "./constants";

const PHOTOREALISTIC_LAYER_ID = "google-3d-tiles";
const MODEL_LAYER_ID = "uploaded-model";
type CameraMode = "orbit" | "free";

type DeckClickInfo = {
  coordinate?: [number, number] | null;
  object?: unknown;
  layer?: { id: string };
};

type MapClickPosition = {
  latitude: number;
  longitude: number;
};

type DragInfo = DeckClickInfo & {
  sourceEvent?: PointerEvent | MouseEvent | TouchEvent;
};

type ControllerConfig = {
  doubleClickZoom: boolean;
  dragMode: "pan" | "rotate";
  inertia: number;
  keyboard: boolean;
};

type DeckSceneCallbacks = {
  onViewStateChange?: (state: CameraViewState) => void;
  onTilesetLoad?: (tileset: Tileset3D) => void;
  onTileLoad?: (tile: unknown) => void;
  onTileError?: (error: unknown) => void;
  onMapClick?: (position: MapClickPosition) => void;
  onModelError?: (error: unknown) => void;
  onModelDragStart?: (info: MapClickPosition) => void;
  onModelDrag?: (info: MapClickPosition) => void;
  onModelDragEnd?: () => void;
};

type DeckSceneOptions = {
  canvas: HTMLCanvasElement;
  initialViewState: CameraViewState;
  shouldAutoCenter: boolean;
  initialCameraMode?: CameraMode;
  callbacks?: DeckSceneCallbacks;
};

export class DeckScene {
  private deck: Deck | null = null;
  private viewState: CameraViewState;
  private photorealisticLayer: Tile3DLayer | null = null;
  private modelLayer: ScenegraphLayer | null = null;
  private ownedScenegraphUrl: string | null = null;
  private readonly callbacks: DeckSceneCallbacks;
  private readonly shouldAutoCenter: boolean;
  private readonly lightingEffect: LightingEffect;
  private controllerConfig: ControllerConfig;
  private cameraMode: CameraMode;

  constructor(options: DeckSceneOptions) {
    this.viewState = options.initialViewState;
    this.callbacks = options.callbacks ?? {};
    this.shouldAutoCenter = options.shouldAutoCenter;
    this.cameraMode = options.initialCameraMode ?? "orbit";
    this.controllerConfig = this.createControllerConfig(this.cameraMode);
    const ambientLight = new AmbientLight({ color: [255, 255, 255], intensity: 0.7 });
    const sunLight = new DirectionalLight({
      color: [255, 255, 255],
      intensity: 2.5,
      direction: [-0.5, -1.5, -0.2],
    });
    this.lightingEffect = new LightingEffect({ ambientLight, sunLight });

    this.initializeDeck(options.canvas);
  }

  private createControllerConfig(mode: CameraMode): ControllerConfig {
    return {
      doubleClickZoom: true,
      dragMode: mode === "free" ? "rotate" : "pan",
      inertia: mode === "free" ? 0 : 400,
      keyboard: true,
    };
  }

  private initializeDeck(canvas: HTMLCanvasElement) {
    this.deck = new Deck({
      canvas,
      controller: this.controllerConfig,
      initialViewState: this.viewState,
      onViewStateChange: ({ viewState }) => {
        this.setViewState(viewState as Partial<CameraViewState>);
      },
      onDragStart: (info) => this.handleDrag(info as DragInfo, "start"),
      onDrag: (info) => this.handleDrag(info as DragInfo, "drag"),
      onDragEnd: (info) => this.handleDrag(info as DragInfo, "end"),
      onClick: (info) => {
        this.handleMapClick(info as DeckClickInfo);
      },
      layers: [],
      effects: [this.lightingEffect],
    });
  }

  initializeLayers(apiKey: string) {
    if (this.photorealisticLayer) return;
    this.photorealisticLayer = this.createPhotorealisticLayer(apiKey);
    this.syncLayers();
  }

  setCameraMode(mode: CameraMode) {
    if (mode === this.cameraMode) return;
    this.cameraMode = mode;
    this.controllerConfig = this.createControllerConfig(mode);
    this.deck?.setProps({ controller: this.controllerConfig });
  }

  private createPhotorealisticLayer(apiKey: string) {
    return new Tile3DLayer({
      id: PHOTOREALISTIC_LAYER_ID,
      data: buildGoogleTilesUrl(apiKey),
      loader: Tiles3DLoader,
      loadOptions: {
        fetch: {
          headers: {
            "X-GOOG-API-KEY": apiKey,
          },
        },
        "3d-tiles": {
          loadGLTFs: true,
        },
      },
      onTilesetLoad: (tileset) => this.handleTilesetLoad(tileset),
      onTileLoad: (tile) => this.callbacks.onTileLoad?.(tile),
      onTileError: (error) => this.callbacks.onTileError?.(error),
    });
  }

  private handleTilesetLoad(tileset: Tileset3D) {
    if (this.shouldAutoCenter && tileset.cartographicCenter) {
      const [longitude, latitude] = tileset.cartographicCenter;
      const zoom = typeof tileset.zoom === "number" ? tileset.zoom : this.viewState.zoom;
      this.setViewState({ longitude, latitude, zoom });
    }
    this.callbacks.onTilesetLoad?.(tileset);
  }

  private syncLayers() {
    if (!this.deck) return;
    const layers = [this.photorealisticLayer, this.modelLayer].filter(Boolean);
    this.deck.setProps({ layers });
  }

  setViewState(partial: Partial<CameraViewState>) {
    this.viewState = {
      ...this.viewState,
      ...partial,
      minZoom: this.viewState.minZoom,
      maxZoom: this.viewState.maxZoom,
    };
    this.viewState.zoom = clampZoom(this.viewState.zoom);
    if (this.deck) {
      this.deck.setProps({ viewState: this.viewState });
    }
    this.callbacks.onViewStateChange?.(this.viewState);
  }

  updateModel(modelState: ModelState | null) {
    if (!modelState?.scenegraphSource) {
      if (this.ownedScenegraphUrl) {
        URL.revokeObjectURL(this.ownedScenegraphUrl);
        this.ownedScenegraphUrl = null;
      }
      this.modelLayer = null;
      this.syncLayers();
      return;
    }

    if (this.ownedScenegraphUrl) {
      URL.revokeObjectURL(this.ownedScenegraphUrl);
      this.ownedScenegraphUrl = null;
    }

    const scenegraph =
      modelState.scenegraphSource instanceof Blob || modelState.scenegraphSource instanceof File
        ? URL.createObjectURL(modelState.scenegraphSource)
        : modelState.scenegraphSource;

    if (scenegraph.startsWith("blob:")) {
      this.ownedScenegraphUrl = scenegraph;
    }

    this.modelLayer = new ScenegraphLayer({
      id: MODEL_LAYER_ID,
      scenegraph,
      data: [
        {
          position: [
            modelState.position.lng,
            modelState.position.lat,
            modelState.position.altitude,
          ],
          orientation: [modelState.transform.pitch, 0, modelState.transform.rotation],
        },
      ],
      sizeScale: modelState.transform.scale * MODEL_BASE_SIZE,
      getPosition: (d) => d.position,
      getOrientation: (d) => d.orientation,
      _animations: { "*": { speed: 0 } },
      pickable: true,
      onError: (error) => this.callbacks.onModelError?.(error),
    });

    this.syncLayers();
  }

  getCurrentViewState(): CameraViewState {
    return this.viewState;
  }

  private handleMapClick(info: DeckClickInfo) {
    if (!info.coordinate) return;
    const [longitude, latitude] = info.coordinate;
    this.callbacks.onMapClick?.({ latitude, longitude });
  }

  private handleDrag(info: DragInfo, phase: "start" | "drag" | "end") {
    if (!info.coordinate) return;
    if (info.layer?.id !== MODEL_LAYER_ID) return;
    const [longitude, latitude] = info.coordinate;
    if (phase === "start") {
      this.callbacks.onModelDragStart?.({ latitude, longitude });
    } else if (phase === "drag") {
      this.callbacks.onModelDrag?.({ latitude, longitude });
    } else {
      this.callbacks.onModelDragEnd?.();
    }
  }
}

export type { CameraMode };
