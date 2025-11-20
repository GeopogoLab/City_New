import { Box3, Group, Vector3 } from "three";
import { MODEL_BASE_SIZE } from "./constants";

/**
 * Normalizes a 3D model by scaling it to a standard size and centering its pivot point
 * @param model - The Three.js Group object representing the 3D model
 * @param targetSize - The desired maximum dimension in meters (default: 60)
 */
export const normalizeModel = (model: Group, targetSize: number = MODEL_BASE_SIZE): void => {
  const box = new Box3().setFromObject(model);
  const size = box.getSize(new Vector3());
  const maxAxis = Math.max(size.x, size.y, size.z) || 1;
  model.scale.setScalar(targetSize / maxAxis);
  const center = box.getCenter(new Vector3());
  model.position.sub(center); // drop pivot to anchor
};

/**
 * Validates if a file has a valid GLTF/GLB extension
 * @param filename - The name of the file to validate
 * @returns true if the file has .gltf or .glb extension
 */
export const isValidModelFile = (filename: string): boolean => {
  return /\.(gltf|glb|obj)$/i.test(filename);
};

/**
 * Formats altitude value for display
 * @param altitude - Altitude value in meters
 * @returns Formatted string with units
 */
export const formatAltitude = (altitude: number): string => {
  return `${Math.round(altitude)} m`;
};

/**
 * Updates anchor position with new coordinates
 * @param currentAnchor - Current anchor position
 * @param lat - New latitude (optional)
 * @param lng - New longitude (optional)
 * @param altitude - New altitude (optional)
 * @returns Updated anchor position
 */
export const updateAnchorPosition = (
  currentAnchor: google.maps.LatLngAltitudeLiteral,
  lat?: number,
  lng?: number,
  altitude?: number
): google.maps.LatLngAltitudeLiteral => {
  return {
    lat: lat ?? currentAnchor.lat,
    lng: lng ?? currentAnchor.lng,
    altitude: altitude ?? currentAnchor.altitude,
  };
};
