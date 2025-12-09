import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const envPath = resolve(process.cwd(), ".env");
const envFile = existsSync(envPath) ? readFileSync(envPath, "utf8") : "";
const env = {};

envFile.split("\n").forEach((line) => {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith("#")) return;
  const [key, ...rest] = trimmed.split("=");
  env[key] = rest.join("=").trim();
});

const apiKey = process.env.VITE_GOOGLE_MAPS_API_KEY ?? env.VITE_GOOGLE_MAPS_API_KEY;

if (!apiKey) {
  console.error("Missing VITE_GOOGLE_MAPS_API_KEY in process env or .env");
  process.exit(1);
}

const sampleLatLng = { lat: 37.793, lng: -122.403 };

const tests = [
  {
    name: "Photorealistic 3D Tiles",
    url: `https://tile.googleapis.com/v1/3dtiles/root.json?key=${apiKey}`,
    parse: async (res) => {
      const json = await res.json().catch(() => null);
      if (res.ok) return { ok: true, detail: `status ${res.status}` };
      const msg = json?.error?.message ?? res.statusText;
      return { ok: false, detail: msg };
    },
  },
  {
    name: "Elevation API",
    url: `https://maps.googleapis.com/maps/api/elevation/json?locations=${sampleLatLng.lat},${sampleLatLng.lng}&key=${apiKey}`,
    parse: async (res) => {
      const json = await res.json().catch(() => null);
      if (res.ok && json?.status === "OK") {
        const elevation = json?.results?.[0]?.elevation;
        const detail = elevation !== undefined ? `status OK, elevation ${elevation.toFixed(2)}m` : "status OK";
        return { ok: true, detail };
      }
      const msg = json?.error_message ?? json?.status ?? res.statusText;
      return { ok: false, detail: msg };
    },
  },
  {
    name: "Geocoding API",
    url: `https://maps.googleapis.com/maps/api/geocode/json?address=Golden%20Gate%20Bridge&key=${apiKey}`,
    parse: async (res) => {
      const json = await res.json().catch(() => null);
      if (res.ok && json?.status === "OK") {
        const formatted = json.results?.[0]?.formatted_address;
        return { ok: true, detail: formatted ?? "status OK" };
      }
      const msg = json?.error_message ?? json?.status ?? res.statusText;
      return { ok: false, detail: msg };
    },
  },
];

const run = async () => {
  for (const test of tests) {
    process.stdout.write(`${test.name}: `);
    try {
      const res = await fetch(test.url, {
        headers: { "X-GOOG-API-KEY": apiKey },
      });
      const parsed = await test.parse(res);
      console.log(parsed.ok ? `OK (${parsed.detail})` : `FAIL (${parsed.detail})`);
    } catch (error) {
      console.log(
        `ERROR (${error instanceof Error ? error.message : typeof error === "string" ? error : "Unknown error"})`
      );
    }
  }
};

run();
