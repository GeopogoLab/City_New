import { CAMERA_DEFAULTS, DEFAULT_LOCATION, VIEW_DISTANCE_RANGE } from "./constants";

export interface CameraViewState {
  longitude: number;
  latitude: number;
  zoom: number;
  pitch: number;
  bearing: number;
  minZoom: number;
  maxZoom: number;
}

export interface ModelTransform {
  scale: number;
  rotation: number;
  pitch: number;
}

export interface ModelPosition {
  lat: number;
  lng: number;
  altitude: number;
}

export interface ModelState {
  scenegraphSource: Blob | File | string | null;
  baseScale: number;
  transform: ModelTransform;
  position: ModelPosition;
}

export const clampZoom = (value: number): number =>
  Math.min(VIEW_DISTANCE_RANGE.max, Math.max(VIEW_DISTANCE_RANGE.min, value));

export const createInitialViewState = (zoom: number): CameraViewState => ({
  longitude: DEFAULT_LOCATION.longitude,
  latitude: DEFAULT_LOCATION.latitude,
  zoom: clampZoom(zoom),
  pitch: CAMERA_DEFAULTS.pitch,
  bearing: CAMERA_DEFAULTS.bearing,
  minZoom: VIEW_DISTANCE_RANGE.min,
  maxZoom: VIEW_DISTANCE_RANGE.max,
});

export const createModelState = (): ModelState => ({
  scenegraphSource: null,
  baseScale: 1,
  transform: { scale: 1, rotation: 0, pitch: 0 },
  position: {
    lat: DEFAULT_LOCATION.latitude,
    lng: DEFAULT_LOCATION.longitude,
    altitude: 0,
  },
});
