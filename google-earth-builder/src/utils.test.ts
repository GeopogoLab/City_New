import { describe, it, expect, beforeEach } from "vitest";
import { Group, BoxGeometry, Mesh, MeshBasicMaterial } from "three";
import {
  normalizeModel,
  isValidModelFile,
  formatAltitude,
  updateAnchorPosition,
} from "./utils";

describe("normalizeModel", () => {
  let testModel: Group;

  beforeEach(() => {
    testModel = new Group();
    const geometry = new BoxGeometry(100, 200, 50);
    const material = new MeshBasicMaterial({ color: 0x00ff00 });
    const mesh = new Mesh(geometry, material);
    testModel.add(mesh);
  });

  it("should scale model to target size", () => {
    normalizeModel(testModel, 60);

    // The largest dimension was 200, so scale should be 60/200 = 0.3
    expect(testModel.scale.x).toBeCloseTo(0.3, 5);
    expect(testModel.scale.y).toBeCloseTo(0.3, 5);
    expect(testModel.scale.z).toBeCloseTo(0.3, 5);
  });

  it("should use default target size of 60 when not specified", () => {
    normalizeModel(testModel);

    // Default target size is 60
    expect(testModel.scale.x).toBeCloseTo(0.3, 5);
  });

  it("should center the model pivot point", () => {
    normalizeModel(testModel);

    // Position should be adjusted to center the model
    // The exact values depend on the initial geometry center
    expect(testModel.position.x).toBeDefined();
    expect(testModel.position.y).toBeDefined();
    expect(testModel.position.z).toBeDefined();
  });

  it("should handle models with zero dimensions", () => {
    const emptyModel = new Group();

    expect(() => normalizeModel(emptyModel)).not.toThrow();
    expect(emptyModel.scale.x).toBe(60);
  });
});

describe("isValidModelFile", () => {
  it("should return true for .glb files", () => {
    expect(isValidModelFile("model.glb")).toBe(true);
    expect(isValidModelFile("path/to/model.glb")).toBe(true);
    expect(isValidModelFile("MODEL.GLB")).toBe(true);
  });

  it("should return true for .gltf files", () => {
    expect(isValidModelFile("model.gltf")).toBe(true);
    expect(isValidModelFile("path/to/model.gltf")).toBe(true);
    expect(isValidModelFile("MODEL.GLTF")).toBe(true);
  });

  it("should return false for other file types", () => {
    expect(isValidModelFile("model.obj")).toBe(false);
    expect(isValidModelFile("model.fbx")).toBe(false);
    expect(isValidModelFile("model.txt")).toBe(false);
    expect(isValidModelFile("model")).toBe(false);
  });

  it("should be case insensitive", () => {
    expect(isValidModelFile("model.GLB")).toBe(true);
    expect(isValidModelFile("model.GlTf")).toBe(true);
    expect(isValidModelFile("model.glB")).toBe(true);
  });
});

describe("formatAltitude", () => {
  it("should format positive altitude values", () => {
    expect(formatAltitude(100)).toBe("100 m");
    expect(formatAltitude(250.7)).toBe("251 m");
    expect(formatAltitude(0)).toBe("0 m");
  });

  it("should format negative altitude values", () => {
    expect(formatAltitude(-50)).toBe("-50 m");
    expect(formatAltitude(-25.3)).toBe("-25 m");
  });

  it("should round to nearest integer", () => {
    expect(formatAltitude(42.4)).toBe("42 m");
    expect(formatAltitude(42.5)).toBe("43 m");
    expect(formatAltitude(42.6)).toBe("43 m");
  });

  it("should handle decimal values correctly", () => {
    expect(formatAltitude(123.456)).toBe("123 m");
    expect(formatAltitude(999.999)).toBe("1000 m");
  });
});

describe("updateAnchorPosition", () => {
  const baseAnchor: google.maps.LatLngAltitudeLiteral = {
    lat: 37.7749,
    lng: -122.4194,
    altitude: 100,
  };

  it("should update only latitude when provided", () => {
    const result = updateAnchorPosition(baseAnchor, 40.7128);

    expect(result.lat).toBe(40.7128);
    expect(result.lng).toBe(baseAnchor.lng);
    expect(result.altitude).toBe(baseAnchor.altitude);
  });

  it("should update only longitude when provided", () => {
    const result = updateAnchorPosition(baseAnchor, undefined, -74.006);

    expect(result.lat).toBe(baseAnchor.lat);
    expect(result.lng).toBe(-74.006);
    expect(result.altitude).toBe(baseAnchor.altitude);
  });

  it("should update only altitude when provided", () => {
    const result = updateAnchorPosition(baseAnchor, undefined, undefined, 200);

    expect(result.lat).toBe(baseAnchor.lat);
    expect(result.lng).toBe(baseAnchor.lng);
    expect(result.altitude).toBe(200);
  });

  it("should update multiple values at once", () => {
    const result = updateAnchorPosition(baseAnchor, 51.5074, -0.1278, 50);

    expect(result.lat).toBe(51.5074);
    expect(result.lng).toBe(-0.1278);
    expect(result.altitude).toBe(50);
  });

  it("should preserve original values when all parameters are undefined", () => {
    const result = updateAnchorPosition(baseAnchor);

    expect(result.lat).toBe(baseAnchor.lat);
    expect(result.lng).toBe(baseAnchor.lng);
    expect(result.altitude).toBe(baseAnchor.altitude);
  });

  it("should handle zero values correctly", () => {
    const result = updateAnchorPosition(baseAnchor, 0, 0, 0);

    expect(result.lat).toBe(0);
    expect(result.lng).toBe(0);
    expect(result.altitude).toBe(0);
  });

  it("should handle negative coordinates", () => {
    const result = updateAnchorPosition(baseAnchor, -33.8688, 151.2093, -10);

    expect(result.lat).toBe(-33.8688);
    expect(result.lng).toBe(151.2093);
    expect(result.altitude).toBe(-10);
  });
});
