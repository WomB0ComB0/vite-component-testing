/// <reference types="vite/client" />

interface ImportMetaEnv {
  VITE_JWT_SECRETS: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

export {  }