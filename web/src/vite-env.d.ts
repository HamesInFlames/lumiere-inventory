/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_WHATSAPP_PHONE?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
