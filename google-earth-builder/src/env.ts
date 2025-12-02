export const shouldAutoCenterOnTileset = import.meta.env.VITE_AUTO_CENTER_TILESET === "true";

export const getGoogleMapsApiKey = (): string | null => {
  const rawValue = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
  if (typeof rawValue !== "string") return null;
  const trimmed = rawValue.trim();
  return trimmed.length > 0 ? trimmed : null;
};

export const getMapboxAccessToken = (): string | null => {
  const rawValue = import.meta.env.VITE_MAPBOX_ACCESS_TOKEN;
  if (typeof rawValue !== "string") return null;
  const trimmed = rawValue.trim();
  return trimmed.length > 0 ? trimmed : null;
};

export const buildGoogleTilesUrl = (apiKey: string): string =>
  `https://tile.googleapis.com/v1/3dtiles/root.json?key=${encodeURIComponent(apiKey)}`;
