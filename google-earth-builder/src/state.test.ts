import { describe, it, expect } from "vitest";
import { clampZoom, createInitialViewState } from "./state";
import { VIEW_DISTANCE_RANGE, CAMERA_DEFAULTS, DEFAULT_LOCATION } from "./constants";

describe("clampZoom", () => {
  it("clamps values below the minimum", () => {
    expect(clampZoom(VIEW_DISTANCE_RANGE.min - 10)).toBe(VIEW_DISTANCE_RANGE.min);
  });

  it("clamps values above the maximum", () => {
    expect(clampZoom(VIEW_DISTANCE_RANGE.max + 5)).toBe(VIEW_DISTANCE_RANGE.max);
  });

  it("returns in-range values untouched", () => {
    const target = (VIEW_DISTANCE_RANGE.min + VIEW_DISTANCE_RANGE.max) / 2;
    expect(clampZoom(target)).toBe(target);
  });
});

describe("createInitialViewState", () => {
  it("applies default camera angles and location", () => {
    const state = createInitialViewState(VIEW_DISTANCE_RANGE.default);
    expect(state.latitude).toBe(DEFAULT_LOCATION.latitude);
    expect(state.longitude).toBe(DEFAULT_LOCATION.longitude);
    expect(state.pitch).toBe(CAMERA_DEFAULTS.pitch);
    expect(state.bearing).toBe(CAMERA_DEFAULTS.bearing);
  });

  it("clamps zoom based on the global range", () => {
    const state = createInitialViewState(VIEW_DISTANCE_RANGE.max + 10);
    expect(state.zoom).toBe(VIEW_DISTANCE_RANGE.max);
  });
});
