/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_GOOGLE_MAPS_API_KEY: string;
  readonly VITE_MAP_ID: string;
  readonly VITE_AUTO_CENTER_TILESET?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
